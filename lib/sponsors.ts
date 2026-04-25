import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals } from '@/types/db';

export type SponsorRecord = Pick<
  ContractWithTotals,
  | 'id'
  | 'exhibitor_company_name'
  | 'brands_poured'
  | 'booth_count'
  | 'grand_total_cents'
  | 'status'
  | 'sales_rep_id'
  | 'sales_rep_name'
  | 'sales_rep_email'
  | 'signer_1_name'
  | 'signer_1_email'
  | 'billing_contact_name'
  | 'billing_contact_email'
  | 'event_contact_name'
  | 'event_contact_email'
> & {
  activity: {
    id: number;
    action: string;
    occurred_at: string;
    actor_email: string | null;
  }[];
};

export async function getConfirmedSponsors(): Promise<SponsorRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('contracts_with_totals')
    .select(
      'id, exhibitor_company_name, brands_poured, booth_count, grand_total_cents, status, sales_rep_id, sales_rep_name, sales_rep_email, signer_1_name, signer_1_email, billing_contact_name, billing_contact_email, event_contact_name, event_contact_email'
    )
    .in('status', ['signed', 'executed'])
    .order('exhibitor_company_name');
  const rows = (data ?? []) as Omit<SponsorRecord, 'activity'>[];
  const ids = rows.map((r) => r.id);
  const { data: activityRows } = ids.length
    ? await supabase
        .from('audit_log')
        .select('id, contract_id, action, occurred_at, actor_email')
        .in('contract_id', ids)
        .order('occurred_at', { ascending: false })
    : { data: [] };
  const byContract = new Map<string, SponsorRecord['activity']>();
  for (const row of activityRows ?? []) {
    const cid = (row as { contract_id?: string | null }).contract_id;
    if (!cid) continue;
    const list = byContract.get(cid) ?? [];
    list.push({
      id: (row as { id: number }).id,
      action: (row as { action: string }).action,
      occurred_at: (row as { occurred_at: string }).occurred_at,
      actor_email: (row as { actor_email: string | null }).actor_email,
    });
    byContract.set(cid, list.slice(0, 8));
  }

  return rows.map((row) => ({ ...row, activity: byContract.get(row.id) ?? [] }));
}

export function sponsorCategoryFromBrands(brandsPoured: string | null): string {
  const name = (brandsPoured ?? '').toLowerCase();
  if (name.includes('bourbon')) return 'Bourbon';
  if (name.includes('scotch') || name.includes('highland') || name.includes('speyside') || name.includes('islay')) return 'Scotch';
  if (name.includes('irish')) return 'Irish';
  if (name.includes('japanese') || name.includes('japan')) return 'Japanese';
  if (name.includes('rye')) return 'Rye';
  if (name.includes('world') || name.includes('taiwan') || name.includes('india') || name.includes('australia')) return 'World Whiskies';
  return 'Other';
}
