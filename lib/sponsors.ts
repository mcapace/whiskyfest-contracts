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
  | 'sales_rep_name'
  | 'sales_rep_email'
  | 'signer_1_name'
  | 'signer_1_email'
>;

export async function getConfirmedSponsors(): Promise<SponsorRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('contracts_with_totals')
    .select(
      'id, exhibitor_company_name, brands_poured, booth_count, grand_total_cents, status, sales_rep_name, sales_rep_email, signer_1_name, signer_1_email'
    )
    .in('status', ['signed', 'executed'])
    .order('exhibitor_company_name');
  return (data ?? []) as SponsorRecord[];
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
