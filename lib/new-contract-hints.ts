import type { ContractWithTotals } from '@/types/db';

export type SponsorMatch = {
  company: string;
  brandsPoured: string;
  boothCount: number;
  boothRateCents: number;
  previousYearLabel: string;
};

/** Recent distinct company names (most recent first). */
export function recentCompanyNames(contracts: ContractWithTotals[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of contracts) {
    const n = c.exhibitor_company_name?.trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

/** Median booth count for contracts by this rep (or all if admin scope) for same company prefix. */
export function medianBoothCountForCompany(contracts: ContractWithTotals[], companyNorm: string): number | null {
  const matches = contracts.filter(
    (c) => c.exhibitor_company_name?.trim().toLowerCase() === companyNorm,
  );
  if (matches.length === 0) return null;
  const counts = matches.map((c) => c.booth_count).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  return counts.length % 2 ? counts[mid]! : Math.round((counts[mid - 1]! + counts[mid]!) / 2);
}

export function findReturningSponsor(
  contracts: ContractWithTotals[],
  typedCompany: string,
): SponsorMatch | null {
  const q = typedCompany.trim().toLowerCase();
  if (q.length < 3) return null;
  const prior = contracts.find(
    (c) =>
      (c.status === 'signed' || c.status === 'executed') &&
      c.exhibitor_company_name?.trim().toLowerCase() === q,
  );
  if (!prior) return null;
  return {
    company: prior.exhibitor_company_name.trim(),
    brandsPoured: prior.brands_poured?.trim() ?? '',
    boothCount: prior.booth_count,
    boothRateCents: prior.booth_rate_cents,
    previousYearLabel: 'prior WhiskyFest',
  };
}
