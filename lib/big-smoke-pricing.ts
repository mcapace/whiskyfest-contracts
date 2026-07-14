/** Big Smoke Las Vegas 2026 exhibitor packages — from BSLV26 rate sheets. */

export type BigSmokePackageKey =
  | 'cigar_ad_1_5_single'
  | 'cigar_ad_6plus_single'
  | 'cigar_ad_6plus_double'
  | 'cigar_non_ad_single'
  | 'drink_single';

export type BigSmokePackage = {
  key: BigSmokePackageKey;
  /** Rate-sheet family */
  category: 'cigar_advertiser_1_5' | 'cigar_advertiser_6plus' | 'cigar_non_advertiser' | 'drink';
  categoryLabel: string;
  boothLabel: string;
  booth_count: number;
  /** Total package fee in cents (not per-booth when double). */
  fee_cents: number;
};

export const BIG_SMOKE_PACKAGES: readonly BigSmokePackage[] = [
  {
    key: 'cigar_ad_1_5_single',
    category: 'cigar_advertiser_1_5',
    categoryLabel: 'Cigar Advertiser (1–5 page ad)',
    boothLabel: 'Single Booth',
    booth_count: 1,
    fee_cents: 700_000,
  },
  {
    key: 'cigar_ad_6plus_single',
    category: 'cigar_advertiser_6plus',
    categoryLabel: 'Cigar Advertiser (6+ page ad)',
    boothLabel: 'Single Booth',
    booth_count: 1,
    fee_cents: 400_000,
  },
  {
    key: 'cigar_ad_6plus_double',
    category: 'cigar_advertiser_6plus',
    categoryLabel: 'Cigar Advertiser (6+ page ad)',
    boothLabel: 'Double Booth',
    booth_count: 2,
    fee_cents: 650_000,
  },
  {
    key: 'cigar_non_ad_single',
    category: 'cigar_non_advertiser',
    categoryLabel: 'Cigar Non-Advertiser',
    boothLabel: 'Single Booth',
    booth_count: 1,
    fee_cents: 800_000,
  },
  {
    key: 'drink_single',
    category: 'drink',
    categoryLabel: 'Drink Exhibitor',
    boothLabel: 'Single Booth',
    booth_count: 1,
    fee_cents: 1_000_000,
  },
] as const;

export function getBigSmokePackage(key: string | null | undefined): BigSmokePackage | null {
  if (!key) return null;
  return BIG_SMOKE_PACKAGES.find((p) => p.key === key) ?? null;
}

export function bigSmokePackageDisplayName(pkg: BigSmokePackage): string {
  return `${pkg.categoryLabel} — ${pkg.boothLabel}`;
}

/** Per-booth rate stored on the contract so booth_count × rate = package fee. */
export function bigSmokeBoothRateCents(pkg: BigSmokePackage): number {
  return Math.round(pkg.fee_cents / pkg.booth_count);
}

export function isBigSmokePackageKey(key: string | null | undefined): key is BigSmokePackageKey {
  return Boolean(key && BIG_SMOKE_PACKAGES.some((p) => p.key === key));
}

/** Resolve booth_count + per-booth rate from a package key (fee = count × rate). */
export function pricingFromBigSmokePackage(
  packageKey: string | null | undefined,
): { package_key: BigSmokePackageKey; booth_count: number; booth_rate_cents: number; fee_cents: number } | null {
  const pkg = getBigSmokePackage(packageKey);
  if (!pkg) return null;
  return {
    package_key: pkg.key,
    booth_count: pkg.booth_count,
    booth_rate_cents: bigSmokeBoothRateCents(pkg),
    fee_cents: pkg.fee_cents,
  };
}
