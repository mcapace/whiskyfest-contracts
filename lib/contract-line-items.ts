import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContractLineItem } from '@/types/db';

/** $1,000,000 per line item (cents). */
export const MAX_LINE_ITEM_AMOUNT_CENTS = 100_000_000;

export async function fetchContractLineItemsOrdered(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractLineItem[]> {
  const { data, error } = await supabase
    .from('contract_line_items')
    .select('*')
    .eq('contract_id', contractId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchContractLineItemsOrdered:', error);
    return [];
  }
  return (data ?? []) as ContractLineItem[];
}

/**
 * Replaces all line items for a contract (draft saves). Caller must enforce draft-only writes.
 */
export async function replaceContractLineItemsForContract(
  supabase: SupabaseClient,
  contractId: string,
  rows: { description: string; amount_cents: number }[],
): Promise<void> {
  const { error: delErr } = await supabase.from('contract_line_items').delete().eq('contract_id', contractId);
  if (delErr) throw new Error(delErr.message);

  if (rows.length === 0) return;

  const insertPayload = rows.map((r, display_order) => ({
    contract_id: contractId,
    description: r.description.trim(),
    amount_cents: r.amount_cents,
    display_order,
  }));

  const { error: insErr } = await supabase.from('contract_line_items').insert(insertPayload);
  if (insErr) throw new Error(insErr.message);
}
