import { getSupabaseAdmin } from '@/lib/supabase';
import { writeExhibitorRosterStatusForContract } from '@/lib/exhibitor-roster-writeback';
import type { ContractStatus, ContractWithTotals } from '@/types/db';

/** Write NYWE exhibitor sheet status when a linked contract changes. */
export async function syncExhibitorRosterWriteback(
  contract: Pick<
    ContractWithTotals,
    'id' | 'status' | 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number' | 'updated_at' | 'event_id'
  >,
  options?: { trackerStatus?: ContractStatus; statusLabel?: string },
): Promise<void> {
  if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) return;
  try {
    await writeExhibitorRosterStatusForContract(contract, options);
  } catch (err) {
    console.error('[exhibitor-roster] writeback failed', { contractId: contract.id, err });
  }
}

export async function syncExhibitorRosterWritebackById(
  contractId: string,
  options?: { trackerStatus?: ContractStatus; statusLabel?: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('contracts_with_totals')
    .select('id, status, source_sheet_id, source_sheet_tab, source_row_number, updated_at, event_id, exhibitor_company_name, exhibitor_legal_name')
    .eq('id', contractId)
    .maybeSingle<ContractWithTotals>();
  if (!data) return;
  await syncExhibitorRosterWriteback(data, options);
}
