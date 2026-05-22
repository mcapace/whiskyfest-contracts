import { categorizeContractBrands } from '@/lib/brand-category';
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

export async function getConfirmedSponsors(): Promise<{
  sponsors: SponsorRecord[];
  boothRowsByContract: Map<
    string,
    { brand_name: string; brand_category?: string | null; expressions?: string[] }[]
  >;
}> {
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
  const { data: boothBrandRows } = ids.length
    ? await supabase
        .from('contract_booth_brands')
        .select('contract_id, brand_name, brand_category, expressions')
        .in('contract_id', ids)
    : { data: [] };
  const boothRowsByContract = new Map<
    string,
    { brand_name: string; brand_category?: string | null; expressions?: string[] }[]
  >();
  for (const row of boothBrandRows ?? []) {
    const cid = (row as { contract_id: string }).contract_id;
    const name = ((row as { brand_name?: string }).brand_name ?? '').trim();
    if (!name) continue;
    const list = boothRowsByContract.get(cid) ?? [];
    list.push({
      brand_name: name,
      brand_category: (row as { brand_category?: string | null }).brand_category,
      expressions: (row as { expressions?: string[] }).expressions,
    });
    boothRowsByContract.set(cid, list);
  }
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

  return {
    sponsors: rows.map((row) => ({ ...row, activity: byContract.get(row.id) ?? [] })),
    boothRowsByContract,
  };
}

export type BoothBrandRowSnapshot = {
  brand_name: string;
  brand_category?: string | null;
  expressions?: string[];
};

export type BoothBrandRowsByContract = Record<string, BoothBrandRowSnapshot[]>;

/** Sponsor directory category using booth brands when available. */
export function sponsorCategoryForRecord(
  sponsor: Pick<SponsorRecord, 'id' | 'brands_poured' | 'exhibitor_company_name'>,
  boothRowsByContract: BoothBrandRowsByContract,
): string {
  return categorizeContractBrands(
    { brands_poured: sponsor.brands_poured, exhibitor_company_name: sponsor.exhibitor_company_name },
    boothRowsByContract[sponsor.id] ?? [],
  );
}

export function boothBrandRowsRecordFromMap(
  map: Map<string, BoothBrandRowSnapshot[]>,
): BoothBrandRowsByContract {
  return Object.fromEntries(map);
}

export function sponsorCategoryFromBrands(
  brandsPoured: string | null,
  exhibitorCompany?: string | null,
  boothRows: BoothBrandRowSnapshot[] = [],
): string {
  return categorizeContractBrands(
    { brands_poured: brandsPoured, exhibitor_company_name: exhibitorCompany },
    boothRows,
  );
}
