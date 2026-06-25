import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';

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

/** Reconcile NYWE licenses stuck at `sent` when the winery already signed in DocuSign. */
export async function syncNyweExhibitorSignaturesFromDocuSign(options?: {
  batchSize?: number;
  afterId?: string | null;
  notify?: boolean;
  concurrency?: number;
}): Promise<NyweExhibitorSyncResult> {
  const event = await getActiveWineSpectatorEvent();
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
  if (!event) return empty;

  const batchSize = options?.batchSize ?? 20;
  const notify = options?.notify !== false;
  const concurrency = options?.concurrency ?? 3;

  const supabase = getSupabaseAdmin();

  const { count: remainingSent } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'sent')
    .not('docusign_envelope_id', 'is', null);

  let query = supabase
    .from('contracts')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'sent')
    .not('docusign_envelope_id', 'is', null)
    .order('id', { ascending: true })
    .limit(batchSize);

  if (options?.afterId) {
    query = query.gt('id', options.afterId);
  }

  const { data: pendingIds } = await query;

  const result: NyweExhibitorSyncResult = {
    ...empty,
    remainingSent: remainingSent ?? 0,
  };

  const ids = (pendingIds ?? []).map((row) => row.id);
  if (ids.length === 0) return result;

  await mapWithConcurrency(ids, concurrency, async (id) => {
    const contract = await fetchContractWithTotalsById(supabase, id);
    if (!contract || contract.status !== 'sent' || !contract.docusign_envelope_id?.trim()) {
      return;
    }

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

export { NYWE_DOCUSIGN_SYNC_DONE_EVENT } from '@/lib/nywe-docusign-sync-events';
