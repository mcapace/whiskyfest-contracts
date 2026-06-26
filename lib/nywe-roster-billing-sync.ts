import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshContractFromLinkedRoster } from '@/lib/nywe-roster-contract-sync';
import type { ContractWithTotals, Event } from '@/types/db';

/**
 * Refresh NYWE contract fields from the linked Google Sheets roster row.
 * Updates billing, signer, company name, wine, and primary contact — not just billing.
 */
export async function refreshNyweBillingFromRosterForContract(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event,
): Promise<ContractWithTotals> {
  const result = await refreshContractFromLinkedRoster(supabase, contract, event, { revalidate: false });
  return result.contract;
}

/** @deprecated Use refreshContractFromLinkedRoster — billing-only alias kept for imports. */
export { refreshContractFromLinkedRoster };
