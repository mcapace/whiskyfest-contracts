import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import type { ContractWithTotals } from '@/types/db';

export type NyweExhibitorSyncResult = {
  scanned: number;
  partiallySigned: number;
  fullySigned: number;
  unchanged: number;
  errors: number;
  errorSamples: { id: string; company: string; error: string }[];
};

/** Reconcile NYWE licenses stuck at `sent` when the winery already signed in DocuSign. */
export async function syncNyweExhibitorSignaturesFromDocuSign(options?: {
  maxContracts?: number;
  notify?: boolean;
}): Promise<NyweExhibitorSyncResult> {
  const event = await getActiveWineSpectatorEvent();
  const empty: NyweExhibitorSyncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [],
  };
  if (!event) return empty;

  const maxContracts = options?.maxContracts ?? 500;
  const notify = options?.notify !== false;

  const supabase = getSupabaseAdmin();
  const { data: pendingIds } = await supabase
    .from('contracts')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'sent')
    .not('docusign_envelope_id', 'is', null)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(maxContracts);

  const result: NyweExhibitorSyncResult = { ...empty };

  for (const row of pendingIds ?? []) {
    const contract = await fetchContractWithTotalsById(supabase, row.id);
    if (!contract || contract.status !== 'sent' || !contract.docusign_envelope_id?.trim()) {
      continue;
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
        continue;
      }

      if (!sync.changed) {
        result.unchanged += 1;
        continue;
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
  }

  return result;
}
