import { isDocuSignRateLimitError } from '@/lib/docusign';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

export type ExhibitorDocuSignSyncResult = {
  scanned: number;
  partiallySigned: number;
  fullySigned: number;
  unchanged: number;
  errors: number;
  errorSamples: { id: string; company: string; error: string }[];
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

/** Reconcile sent/error contracts when DocuSign already has signatures (WhiskyFest + NYWE). */
export async function syncActiveEventExhibitorSignaturesFromDocuSign(options?: {
  batchSize?: number;
  notify?: boolean;
  concurrency?: number;
}): Promise<ExhibitorDocuSignSyncResult> {
  const supabase = getSupabaseAdmin();
  const empty: ExhibitorDocuSignSyncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [],
  };

  const { data: activeEvents } = await supabase.from('events').select('*').eq('is_active', true);
  const eventIds = (activeEvents ?? []).map((e) => e.id as string);
  if (eventIds.length === 0) return empty;

  const eventById = new Map<string, Event>(((activeEvents ?? []) as Event[]).map((e) => [e.id, e]));
  const batchSize = options?.batchSize ?? 25;
  const notify = options?.notify !== false;
  const concurrency = options?.concurrency ?? 3;

  const { data: pendingIds } = await supabase
    .from('contracts')
    .select('id')
    .in('event_id', eventIds)
    .in('status', ['sent', 'error'])
    .not('docusign_envelope_id', 'is', null)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(batchSize);

  const result = { ...empty };
  const ids = (pendingIds ?? []).map((row) => row.id as string);
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

  return result;
}
