import { isDocuSignRateLimitError } from '@/lib/docusign';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { docuSignPollCutoffIso } from '@/lib/docusign-poll-cooldown';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getActiveWineSpectatorEventIds, getActiveWineSpectatorEvents } from '@/lib/wine-spectator-event';

export type NyweExhibitorSyncResult = {
  scanned: number;
  partiallySigned: number;
  fullySigned: number;
  unchanged: number;
  errors: number;
  errorSamples: { id: string; company: string; error: string }[];
  nextAfterId: string | null;
  hasMore: boolean;
  remainingSent: number;
};

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

/** Reconcile NYWE licenses stuck at `sent` / `error` when the winery already signed in DocuSign. */
export async function syncNyweExhibitorSignaturesFromDocuSign(options?: {
  batchSize?: number;
  afterId?: string | null;
  notify?: boolean;
  concurrency?: number;
}): Promise<NyweExhibitorSyncResult> {
  const eventIds = await getActiveWineSpectatorEventIds();
  const empty: NyweExhibitorSyncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [],
    nextAfterId: null,
    hasMore: false,
    remainingSent: 0,
  };
  if (eventIds.length === 0) return empty;

  const events = await getActiveWineSpectatorEvents();
  const eventById = new Map(events.map((e) => [e.id, e]));

  const batchSize = options?.batchSize ?? 20;
  const notify = options?.notify !== false;
  const concurrency = options?.concurrency ?? 3;

  const supabase = getSupabaseAdmin();

  const { count: remainingSent } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .in('event_id', eventIds)
    .in('status', ['sent', 'error'])
    .not('docusign_envelope_id', 'is', null);

  const pollCutoff = docuSignPollCutoffIso();
  let query = supabase
    .from('contracts')
    .select('id')
    .in('event_id', eventIds)
    .in('status', ['sent', 'error'])
    .not('docusign_envelope_id', 'is', null)
    .or(`docusign_last_polled_at.is.null,docusign_last_polled_at.lt.${pollCutoff}`)
    .order('docusign_last_polled_at', { ascending: true, nullsFirst: true })
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(batchSize);

  if (options?.afterId) {
    query = query.gt('id', options.afterId);
  }

  let { data: pendingIds, error: pendingErr } = await query;
  if (pendingErr?.message?.includes('docusign_last_polled_at')) {
    let fallback = supabase
      .from('contracts')
      .select('id')
      .in('event_id', eventIds)
      .in('status', ['sent', 'error'])
      .not('docusign_envelope_id', 'is', null)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(batchSize);
    if (options?.afterId) {
      fallback = fallback.gt('id', options.afterId);
    }
    ({ data: pendingIds } = await fallback);
  }

  const result: NyweExhibitorSyncResult = {
    ...empty,
    remainingSent: remainingSent ?? 0,
  };

  const ids = (pendingIds ?? []).map((row) => row.id);
  if (ids.length === 0) return result;

  await mapWithConcurrency(ids, concurrency, async (id) => {
    if (result.errors > 0 && result.errorSamples.some((e) => isDocuSignRateLimitError(new Error(e.error)))) {
      return;
    }

    const contract = await fetchContractWithTotalsById(supabase, id);
    if (
      !contract ||
      !['sent', 'error'].includes(contract.status) ||
      !contract.docusign_envelope_id?.trim()
    ) {
      return;
    }

    const event = eventById.get(contract.event_id);
    if (!event) return;

    result.scanned += 1;

    try {
      const sync = await syncContractFromDocuSign(supabase, contract, event, null, { notify });
      if (!sync.ok) {
        result.errors += 1;
        if (result.errorSamples.length < 8) {
          result.errorSamples.push({
            id: contract.id,
            company: contract.exhibitor_company_name,
            error: sync.error,
          });
        }
        if (isDocuSignRateLimitError(new Error(sync.error))) return;
        return;
      }

      if (!sync.changed) {
        result.unchanged += 1;
        return;
      }

      if (sync.toStatus === 'partially_signed') result.partiallySigned += 1;
      else if (sync.toStatus === 'signed') result.fullySigned += 1;
      else result.unchanged += 1;
    } catch (err) {
      result.errors += 1;
      if (result.errorSamples.length < 8) {
        result.errorSamples.push({
          id: contract.id,
          company: contract.exhibitor_company_name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  const lastId = ids[ids.length - 1] ?? null;
  result.nextAfterId = lastId;
  result.hasMore = ids.length === batchSize;
  result.remainingSent = Math.max(0, (remainingSent ?? 0) - result.partiallySigned - result.fullySigned);

  return result;
}

/** Run batched sync until every sent license has been checked once (or maxBatches reached). */
export async function syncAllNyweExhibitorSignaturesFromDocuSign(options?: {
  batchSize?: number;
  maxBatches?: number;
  notify?: boolean;
}): Promise<NyweExhibitorSyncResult> {
  const batchSize = options?.batchSize ?? 20;
  const maxBatches = options?.maxBatches ?? 30;
  const notify = options?.notify !== false;

  const totals: NyweExhibitorSyncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [],
    nextAfterId: null,
    hasMore: false,
    remainingSent: 0,
  };

  let afterId: string | null = null;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await syncNyweExhibitorSignaturesFromDocuSign({
      batchSize,
      afterId,
      notify: notify && batch === 0,
      concurrency: 3,
    });

    totals.scanned += result.scanned;
    totals.partiallySigned += result.partiallySigned;
    totals.fullySigned += result.fullySigned;
    totals.unchanged += result.unchanged;
    totals.errors += result.errors;
    totals.errorSamples.push(...result.errorSamples.slice(0, Math.max(0, 8 - totals.errorSamples.length)));
    totals.remainingSent = result.remainingSent;
    totals.nextAfterId = result.nextAfterId;
    totals.hasMore = result.hasMore;

    if (!result.hasMore || !result.nextAfterId) break;
    afterId = result.nextAfterId;
  }

  return totals;
}

/** Reconcile NYWE licenses at `partially_signed` when Susannah already countersigned in DocuSign. */
export async function syncNyweCountersignaturesFromDocuSign(options?: {
  notify?: boolean;
  concurrency?: number;
  limit?: number;
}): Promise<Pick<NyweExhibitorSyncResult, 'scanned' | 'fullySigned' | 'unchanged' | 'errors' | 'errorSamples'>> {
  const eventIds = await getActiveWineSpectatorEventIds();
  const empty = { scanned: 0, fullySigned: 0, unchanged: 0, errors: 0, errorSamples: [] as NyweExhibitorSyncResult['errorSamples'] };
  if (eventIds.length === 0) return empty;

  const events = await getActiveWineSpectatorEvents();
  const eventById = new Map(events.map((e) => [e.id, e]));

  const supabase = getSupabaseAdmin();
  const { data: pendingIds } = await supabase
    .from('contracts')
    .select('id')
    .in('event_id', eventIds)
    .eq('status', 'partially_signed')
    .not('docusign_envelope_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(options?.limit ?? 25);

  const result = { ...empty };
  const ids = (pendingIds ?? []).map((row) => row.id);
  if (ids.length === 0) return result;

  await mapWithConcurrency(ids, options?.concurrency ?? 3, async (id) => {
    if (result.errors > 0 && result.errorSamples.some((e) => isDocuSignRateLimitError(new Error(e.error)))) {
      return;
    }

    const contract = await fetchContractWithTotalsById(supabase, id);
    if (!contract || contract.status !== 'partially_signed' || !contract.docusign_envelope_id?.trim()) {
      return;
    }

    const event = eventById.get(contract.event_id);
    if (!event) return;

    result.scanned += 1;

    try {
      const sync = await syncContractFromDocuSign(supabase, contract, event, null, {
        notify: options?.notify !== false,
      });
      if (!sync.ok) {
        result.errors += 1;
        if (result.errorSamples.length < 8) {
          result.errorSamples.push({
            id: contract.id,
            company: contract.exhibitor_company_name,
            error: sync.error,
          });
        }
        if (isDocuSignRateLimitError(new Error(sync.error))) return;
        return;
      }
      if (sync.changed && sync.toStatus === 'signed') result.fullySigned += 1;
      else result.unchanged += 1;
    } catch (err) {
      result.errors += 1;
      if (result.errorSamples.length < 8) {
        result.errorSamples.push({
          id: contract.id,
          company: contract.exhibitor_company_name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  return result;
}

export type NyweDocuSignReconcileResult = {
  exhibitor: NyweExhibitorSyncResult;
  countersign: Awaited<ReturnType<typeof syncNyweCountersignaturesFromDocuSign>>;
  accounting: Awaited<ReturnType<typeof releaseSignedContractsToAccounting>>;
};

/**
 * Full NYWE DocuSign pipeline refresh: winery signatures, countersignatures, and release to accounting.
 */
export async function reconcileNyweDocuSignPipeline(options?: {
  exhibitorBatchSize?: number;
  exhibitorAll?: boolean;
  afterId?: string | null;
  notify?: boolean;
  releaseLimit?: number;
}): Promise<NyweDocuSignReconcileResult> {
  const batchSize = options?.exhibitorBatchSize ?? 25;
  const notify = options?.notify !== false;

  const exhibitor = options?.exhibitorAll
    ? await syncAllNyweExhibitorSignaturesFromDocuSign({
        batchSize,
        maxBatches: 40,
        notify,
      })
    : await syncNyweExhibitorSignaturesFromDocuSign({
        batchSize,
        afterId: options?.afterId ?? null,
        notify,
        concurrency: 3,
      });

  const countersign = await syncNyweCountersignaturesFromDocuSign({ notify, limit: batchSize });
  const accounting = await releaseSignedContractsToAccounting({ limit: options?.releaseLimit ?? 100 });

  return { exhibitor, countersign, accounting };
}
