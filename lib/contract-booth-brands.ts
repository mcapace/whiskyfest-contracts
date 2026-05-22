import type { SupabaseClient } from '@supabase/supabase-js';
import { brandsPouredSummaryFromBoothBrandNames } from '@/lib/brand-category';
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
  rows: { booth_index: number; brand_name: string; brand_category?: string | null; expressions: string[] }[],
): Promise<void> {
  const { error: delErr } = await supabase.from('contract_booth_brands').delete().eq('contract_id', contractId);
  if (delErr) throw new Error(delErr.message);

  const byIndex = new Map(rows.map((r) => [r.booth_index, r]));
  const payload: {
    contract_id: string;
    booth_index: number;
    brand_name: string;
    brand_category: string | null;
    expressions: string[];
  }[] = [];

  for (let i = 1; i <= boothCount; i++) {
    const row = byIndex.get(i);
    const brand = row?.brand_name?.trim() ?? '';
    const expressions = (row?.expressions ?? [])
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    const brand_category = row?.brand_category?.trim() || null;
    payload.push({
      contract_id: contractId,
      booth_index: i,
      brand_name: brand,
      brand_category,
      expressions,
    });
  }

  if (payload.length === 0) return;

  const { error: insErr } = await supabase.from('contract_booth_brands').insert(payload);
  if (insErr) throw new Error(insErr.message);

  const brandsPoured = brandsPouredSummaryFromBoothBrandNames(payload.map((p) => p.brand_name));
  await supabase.from('contracts').update({ brands_poured: brandsPoured }).eq('id', contractId);
}

/**
 * Google Docs merge token `{{booth_brands_block}}` — one line per booth.
 * With expressions: Booth 1: Don Julio (Blanco, Reposado)
 * Brand only: Booth 1: Don Julio
 */
export function formatBoothBrandsBlock(brands: ContractBoothBrand[]): string {
  if (!brands.length) return '';
  const sorted = [...brands].sort((a, b) => a.booth_index - b.booth_index);
  return sorted
    .map((b) => {
      const expr = (b.expressions ?? []).filter(Boolean);
      const brand = b.brand_name.trim();
      if (expr.length === 0) return `Booth ${b.booth_index}: ${brand}`;
      return `Booth ${b.booth_index}: ${brand} (${expr.join(', ')})`;
    })
    .join('\n');
}

/** @deprecated Use formatBoothBrandsBlock / {{booth_brands_block}} */
export function formatBoothBrandsMergeDetail(brands: ContractBoothBrand[]): string {
  return formatBoothBrandsBlock(brands);
}
