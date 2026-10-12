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
  const baseRows: {
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
    baseRows.push({
      contract_id: contractId,
      booth_index: i,
      brand_name: brand,
      brand_category,
      expressions,
    });
  }

  if (baseRows.length === 0) return;

  let insErr = (await supabase.from('contract_booth_brands').insert(baseRows)).error;
  if (insErr?.message?.includes('brand_category') && insErr.message.includes('does not exist')) {
    const minimal = baseRows.map(({ brand_category: _c, ...rest }) => rest);
    insErr = (await supabase.from('contract_booth_brands').insert(minimal)).error;
  }
  if (insErr) throw new Error(insErr.message);

  const brandsPoured = brandsPouredSummaryFromBoothBrandNames(baseRows.map((p) => p.brand_name));
  await supabase.from('contracts').update({ brands_poured: brandsPoured }).eq('id', contractId);
}

/** True when at least one submitted booth row names a brand (Big Smoke brands are optional). */
export function hasNamedBoothBrand(
  rows: { brand_name?: string | null }[] | null | undefined,
): boolean {
  return (rows ?? []).some((r) => (r.brand_name ?? '').trim().length > 0);
}

/** NYWE vendor licenses do not use per-booth whisky/spirit brand rows. */
export async function clearContractBoothBrandsForContract(
  supabase: SupabaseClient,
  contractId: string,
): Promise<void> {
  const { error } = await supabase.from('contract_booth_brands').delete().eq('contract_id', contractId);
  if (error) throw new Error(error.message);
}

/**
 * Google Docs merge token `{{booth_brands_block}}` — one line per booth.
 * With expressions: Booth 1: Don Julio (Blanco, Reposado)
 * Brand only: Booth 1: Don Julio
 */
export function formatBoothBrandsBlock(brands: ContractBoothBrand[]): string {
  // Booths without a named brand (optional on Big Smoke) are left off the contract.
  const sorted = brands
    .filter((b) => (b.brand_name ?? '').trim().length > 0)
    .sort((a, b) => a.booth_index - b.booth_index);
  if (!sorted.length) return '';
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
