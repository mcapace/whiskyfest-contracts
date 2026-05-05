import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContractBoothBrand } from '@/types/db';

export async function fetchContractBoothBrandsOrdered(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractBoothBrand[]> {
  const { data, error } = await supabase
    .from('contract_booth_brands')
    .select('*')
    .eq('contract_id', contractId)
    .order('booth_index', { ascending: true });

  if (error) {
    console.error('fetchContractBoothBrandsOrdered:', error);
    return [];
  }
  return (data ?? []) as ContractBoothBrand[];
}

/** Normalizes and replaces rows for booth indices 1..boothCount (draft saves). */
export async function replaceContractBoothBrandsForContract(
  supabase: SupabaseClient,
  contractId: string,
  boothCount: number,
  rows: { booth_index: number; brand_name: string; expressions: string[] }[],
): Promise<void> {
  const { error: delErr } = await supabase.from('contract_booth_brands').delete().eq('contract_id', contractId);
  if (delErr) throw new Error(delErr.message);

  const byIndex = new Map(rows.map((r) => [r.booth_index, r]));
  const payload: {
    contract_id: string;
    booth_index: number;
    brand_name: string;
    expressions: string[];
  }[] = [];

  for (let i = 1; i <= boothCount; i++) {
    const row = byIndex.get(i);
    const brand = row?.brand_name?.trim() ?? '';
    const expressions = (row?.expressions ?? [])
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    payload.push({
      contract_id: contractId,
      booth_index: i,
      brand_name: brand,
      expressions,
    });
  }

  if (payload.length === 0) return;

  const { error: insErr } = await supabase.from('contract_booth_brands').insert(payload);
  if (insErr) throw new Error(insErr.message);
}

/** Paragraph-oriented merge token for Google Docs templates. */
export function formatBoothBrandsMergeDetail(brands: ContractBoothBrand[]): string {
  if (!brands.length) return '';
  const sorted = [...brands].sort((a, b) => a.booth_index - b.booth_index);
  return sorted
    .map((b) => {
      const expr = (b.expressions ?? []).filter(Boolean).join(', ');
      return expr.length > 0
        ? `Booth ${b.booth_index}: ${b.brand_name.trim()} — ${expr}`
        : `Booth ${b.booth_index}: ${b.brand_name.trim()}`;
    })
    .join('\n');
}
