import type { SupabaseClient } from '@supabase/supabase-js';
import { voidEnvelope } from '@/lib/docusign';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import {
  canVoidNyweGalloContractForCombine,
  contractQualifiesForGalloCombine,
  wineriesFromContract,
  type NyweCoveredWinery,
} from '@/lib/nywe-combined-contract';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

const CLOSED_STATUSES = new Set(['cancelled', 'voided']);

export type VoidSentGalloResult = {
  voidedIds: string[];
  wineries: NyweCoveredWinery[];
  errors: { id: string; wineryName: string; error: string }[];
};

/**
 * Void DocuSign envelopes for individual Gallo licenses that were already sent,
 * so those wineries can be folded into one combined order.
 * Executed contracts are left alone.
 */
export async function voidSentGalloContractsForEvent(options: {
  supabase: SupabaseClient;
  event: Pick<Event, 'id'>;
  actorEmail: string;
  reason?: string;
}): Promise<VoidSentGalloResult> {
  const reason =
    options.reason?.trim() ||
    'Replacing separate Gallo winery licenses with one combined NYWE contract';

  const { data, error } = await options.supabase
    .from('contracts')
    .select('*')
    .eq('event_id', options.event.id);
  if (error) {
    console.error('[voidSentGalloContractsForEvent]', error.message);
    return { voidedIds: [], wineries: [], errors: [] };
  }

  const targets = ((data ?? []) as Contract[]).filter(
    (contract) =>
      !CLOSED_STATUSES.has(contract.status) &&
      contract.status !== 'executed' &&
      contractQualifiesForGalloCombine(contract) &&
      canVoidNyweGalloContractForCombine(contract),
  );

  const voidedIds: string[] = [];
  const wineries: NyweCoveredWinery[] = [];
  const errors: VoidSentGalloResult['errors'] = [];

  for (const contract of targets) {
    const envelopeId = contract.docusign_envelope_id?.trim() ?? null;
    if (envelopeId) {
      try {
        await voidEnvelope(envelopeId, reason);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Already-voided envelopes should not block the combine.
        if (!/voided|already|terminal/i.test(message)) {
          errors.push({
            id: contract.id,
            wineryName: contract.exhibitor_company_name,
            error: message,
          });
          continue;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await options.supabase
      .from('contracts')
      .update({
        status: 'voided',
        voided_at: nowIso,
        voided_by: options.actorEmail,
        voided_reason: reason,
        source_sheet_id: null,
        source_sheet_tab: null,
        source_row_number: null,
        covered_wineries: null,
      })
      .eq('id', contract.id);
    if (updErr) {
      errors.push({
        id: contract.id,
        wineryName: contract.exhibitor_company_name,
        error: updErr.message,
      });
      continue;
    }

    await options.supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: options.actorEmail,
      action: 'contract_voided',
      from_status: contract.status,
      to_status: 'voided',
      metadata: {
        reason,
        envelope_id: envelopeId ?? undefined,
        gallo_combined_replace: true,
      },
    });

    voidedIds.push(contract.id);
    wineries.push(...wineriesFromContract(contract));

    const { data: latest } = await options.supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('id', contract.id)
      .maybeSingle<ContractWithTotals>();
    if (latest) {
      try {
        await syncExhibitorRosterWriteback(latest, { trackerStatus: 'voided' });
      } catch (err) {
        console.error('[voidSentGalloContractsForEvent] roster', contract.id, err);
      }
    }
    revalidateContractPaths(contract.id);
  }

  return { voidedIds, wineries, errors };
}
