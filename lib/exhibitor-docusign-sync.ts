import { isDocuSignRateLimitError, isDocuSignBackgroundSyncDisabled } from '@/lib/docusign';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { docuSignPollCutoffIso } from '@/lib/docusign-poll-cooldown';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

/** In-flight DocuSign statuses that background sync must keep reconciling. */
const IN_FLIGHT_STATUSES = ['sent', 'partially_signed', 'error'] as const;

export type ExhibitorDocuSignSyncResult = {
  scanned: number;
  partiallySigned: number;
  fullySigned: number;
  unchanged: number;
  errors: number;
  errorSamples: { id: string; company: string; error: string }[];
  rateLimited: boolean;
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

function emptyResult(): ExhibitorDocuSignSyncResult {
  return {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [],
    rateLimited: false,
  };
}

/**
 * Reconcile in-flight contracts (sent / partially_signed / error) when DocuSign already
 * advanced — covers WhiskyFest, NYWE, and Big Smoke.
 */
export async function syncActiveEventExhibitorSignaturesFromDocuSign(options?: {
  batchSize?: number;
  notify?: boolean;
  concurrency?: number;
  /** Bypass poll cooldown (used for overdue catch-up). */
  forcePoll?: boolean;
  /** Only include contracts whose sent_at is at least this many ms ago (overdue pass). */
  minSentAgeMs?: number;
}): Promise<ExhibitorDocuSignSyncResult> {
  if (isDocuSignBackgroundSyncDisabled()) {
    return emptyResult();
  }

  const supabase = getSupabaseAdmin();
  const empty = emptyResult();

  const { data: activeEvents } = await supabase.from('events').select('*').eq('is_active', true);
  const eventIds = (activeEvents ?? []).map((e) => e.id as string);
  if (eventIds.length === 0) return empty;

  const eventById = new Map<string, Event>(((activeEvents ?? []) as Event[]).map((e) => [e.id, e]));
  const batchSize = options?.batchSize ?? 30;
  const notify = options?.notify !== false;
  const concurrency = options?.concurrency ?? 3;
  const forcePoll = options?.forcePoll === true;

  let query = supabase
    .from('contracts')
    .select('id')
    .in('event_id', eventIds)
    .in('status', [...IN_FLIGHT_STATUSES])
    .not('docusign_envelope_id', 'is', null);

  if (!forcePoll) {
    const pollCutoff = docuSignPollCutoffIso();
    query = query.or(`docusign_last_polled_at.is.null,docusign_last_polled_at.lt.${pollCutoff}`);
  }

  if (options?.minSentAgeMs != null && options.minSentAgeMs > 0) {
    const sentBefore = new Date(Date.now() - options.minSentAgeMs).toISOString();
    query = query.lt('sent_at', sentBefore);
  }

  // Oldest polls / oldest sends first so completed envelopes are not buried behind a large sent queue.
  query = query
    .order('docusign_last_polled_at', { ascending: true, nullsFirst: true })
    .order('sent_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(batchSize);

  let { data: pendingIds, error: pendingErr } = await query;
  if (pendingErr?.message?.includes('docusign_last_polled_at')) {
    let fallback = supabase
      .from('contracts')
      .select('id')
      .in('event_id', eventIds)
      .in('status', [...IN_FLIGHT_STATUSES])
      .not('docusign_envelope_id', 'is', null)
      .order('sent_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(batchSize);
    if (options?.minSentAgeMs != null && options.minSentAgeMs > 0) {
      const sentBefore = new Date(Date.now() - options.minSentAgeMs).toISOString();
      fallback = fallback.lt('sent_at', sentBefore);
    }
    ({ data: pendingIds } = await fallback);
  } else if (pendingErr) {
    console.error('[exhibitor-docusign-sync] query failed', pendingErr.message);
    return empty;
  }

  const result = emptyResult();
  const ids = (pendingIds ?? []).map((row) => row.id as string);
  if (ids.length === 0) return result;

  await mapWithConcurrency(ids, concurrency, async (id) => {
    if (result.rateLimited) return;

    const contract = await fetchContractWithTotalsById(supabase, id);
    if (
      !contract ||
      !IN_FLIGHT_STATUSES.includes(contract.status as (typeof IN_FLIGHT_STATUSES)[number]) ||
      !contract.docusign_envelope_id?.trim()
    ) {
      return;
    }

    const event = eventById.get(contract.event_id);
    if (!event) return;

    result.scanned += 1;

    try {
      const sync = await syncContractFromDocuSign(supabase, contract, event, null, {
        notify,
        forcePoll,
      });
      if (!sync.ok) {
        result.errors += 1;
        if (isDocuSignRateLimitError(new Error(sync.error))) {
          result.rateLimited = true;
        }
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
      else if (sync.toStatus === 'signed' || sync.toStatus === 'executed') result.fullySigned += 1;
      else result.unchanged += 1;
    } catch (err) {
      result.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (isDocuSignRateLimitError(err instanceof Error ? err : new Error(msg))) {
        result.rateLimited = true;
      }
      if (result.errorSamples.length < 8) {
        result.errorSamples.push({
          id: contract.id,
          company: contract.exhibitor_company_name,
          error: msg,
        });
      }
    }
  });

  return result;
}
