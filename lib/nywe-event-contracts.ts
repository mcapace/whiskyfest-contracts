import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals } from '@/types/db';

/** Lightweight contract fetch for NYWE roster/dashboard metrics (no booth brands or audit). */
export async function getNyweEventContractsForMetrics(eventId: string): Promise<ContractWithTotals[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  return (data ?? []) as ContractWithTotals[];
}
