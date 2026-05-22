import type { SupabaseClient } from '@supabase/supabase-js';

export type BoothBrandRowSnapshot = {
  contract_id: string;
  brand_name: string;
  brand_category?: string | null;
  expressions?: string[];
};

const SELECT_WITH_CATEGORY = 'contract_id, brand_name, brand_category, expressions';
const SELECT_MINIMAL = 'contract_id, brand_name, expressions';

function isMissingBrandCategoryColumn(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('brand_category') && msg.includes('does not exist');
}

/** Load booth brands; works before migration 039 (brand_category column) is applied. */
export async function fetchBoothBrandsByContractIds(
  supabase: SupabaseClient,
  contractIds: string[],
): Promise<BoothBrandRowSnapshot[]> {
  if (contractIds.length === 0) return [];

  const withCategory = await supabase
    .from('contract_booth_brands')
    .select(SELECT_WITH_CATEGORY)
    .in('contract_id', contractIds);

  if (!withCategory.error) {
    return (withCategory.data ?? []) as BoothBrandRowSnapshot[];
  }

  if (!isMissingBrandCategoryColumn(withCategory.error)) {
    console.error('[fetchBoothBrandsByContractIds]', withCategory.error.message);
    return [];
  }

  const minimal = await supabase
    .from('contract_booth_brands')
    .select(SELECT_MINIMAL)
    .in('contract_id', contractIds);

  if (minimal.error) {
    console.error('[fetchBoothBrandsByContractIds]', minimal.error.message);
    return [];
  }

  return (minimal.data ?? []) as BoothBrandRowSnapshot[];
}
