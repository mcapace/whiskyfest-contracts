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

/** One rate-sheet package line on a contract (qty of that package). */
export type BigSmokePackageSelection = {
  key: BigSmokePackageKey;
  qty: number;
};

export type BigSmokePricing = {
  /** First / primary package key (legacy column + single-package clients). */
  package_key: BigSmokePackageKey;
  package_selections: BigSmokePackageSelection[];
  booth_count: number;
  booth_rate_cents: number;
  fee_cents: number;
  displayName: string;
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

/** Merge duplicate keys and drop invalid / zero-qty rows. */
export function normalizeBigSmokePackageSelections(
  raw: Array<{ key?: string | null; qty?: number | null }> | null | undefined,
): BigSmokePackageSelection[] {
  if (!raw?.length) return [];
  const byKey = new Map<BigSmokePackageKey, number>();
  for (const row of raw) {
    const key = row.key?.trim() ?? '';
    if (!isBigSmokePackageKey(key)) continue;
    const qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    if (qty < 1) continue;
    byKey.set(key, (byKey.get(key) ?? 0) + qty);
  }
  return BIG_SMOKE_PACKAGES.filter((p) => byKey.has(p.key)).map((p) => ({
    key: p.key,
    qty: byKey.get(p.key)!,
  }));
}

export function bigSmokeSelectionsDisplayName(selections: BigSmokePackageSelection[]): string {
  return selections
    .map((sel) => {
      const pkg = getBigSmokePackage(sel.key);
      if (!pkg) return sel.key;
      const name = bigSmokePackageDisplayName(pkg);
      return sel.qty > 1 ? `${sel.qty}× ${name}` : name;
    })
    .join(' + ');
}

/** Aggregate booths + fee from one or more package lines (e.g. Double + Single = 3 booths). */
export function pricingFromBigSmokeSelections(
  selections: BigSmokePackageSelection[],
): BigSmokePricing | null {
  const normalized = normalizeBigSmokePackageSelections(selections);
  if (normalized.length === 0) return null;

  let booth_count = 0;
  let fee_cents = 0;
  for (const sel of normalized) {
    const pkg = getBigSmokePackage(sel.key)!;
    booth_count += pkg.booth_count * sel.qty;
    fee_cents += pkg.fee_cents * sel.qty;
  }
  if (booth_count < 1 || fee_cents < 0) return null;

  return {
    package_key: normalized[0]!.key,
    package_selections: normalized,
    booth_count,
    booth_rate_cents: Math.round(fee_cents / booth_count),
    fee_cents,
    displayName: bigSmokeSelectionsDisplayName(normalized),
  };
}

/** Resolve booth_count + per-booth rate from a package key (fee = count × rate). */
export function pricingFromBigSmokePackage(
  packageKey: string | null | undefined,
): BigSmokePricing | null {
  if (!isBigSmokePackageKey(packageKey)) return null;
  return pricingFromBigSmokeSelections([{ key: packageKey, qty: 1 }]);
}

/**
 * Prefer explicit package_selections; fall back to legacy single package_key.
 * Used by create/update APIs and edit-form hydration.
 */
export function pricingFromBigSmokeInput(input: {
  package_selections?: Array<{ key?: string | null; qty?: number | null }> | null;
  package_key?: string | null;
}): BigSmokePricing | null {
  const fromSelections = pricingFromBigSmokeSelections(
    normalizeBigSmokePackageSelections(input.package_selections),
  );
  if (fromSelections) return fromSelections;
  return pricingFromBigSmokePackage(input.package_key);
}

/** Per-booth rate so booth_count × rate ≈ negotiated total fee. */
export function bigSmokeRateFromNegotiatedFee(boothCount: number, negotiatedFeeCents: number): number {
  if (boothCount < 1) return 0;
  return Math.round(Math.max(0, negotiatedFeeCents) / boothCount);
}

/** Actual package fee stored on the contract (booth_count × booth_rate). */
export function bigSmokeContractFeeCents(contract: {
  booth_count?: number | null;
  booth_rate_cents?: number | null;
}): number {
  return Math.max(0, (contract.booth_count ?? 0) * (contract.booth_rate_cents ?? 0));
}

/** True when contract fee is below the rate-sheet list total for the selected packages. */
export function isBigSmokeDiscountedAgainstList(
  contract: {
    booth_count?: number | null;
    booth_rate_cents?: number | null;
    package_key?: string | null;
    package_selections?: unknown;
  },
): boolean {
  const list = pricingFromBigSmokeInput({
    package_selections: packageSelectionsFromContract(contract),
    package_key: contract.package_key,
  });
  if (!list) return false;
  return bigSmokeContractFeeCents(contract) < list.fee_cents;
}

/**
 * Prefer client negotiated per-booth rate when packages are set; otherwise catalog rate.
 * Near-list totals (rounding) snap back to the catalog rate.
 */
export function resolveBigSmokeStoredBoothRate(
  list: BigSmokePricing,
  clientBoothRateCents: number | null | undefined,
): number {
  if (clientBoothRateCents == null || !Number.isFinite(clientBoothRateCents) || clientBoothRateCents < 0) {
    return list.booth_rate_cents;
  }
  const clientFee = clientBoothRateCents * list.booth_count;
  if (Math.abs(clientFee - list.fee_cents) <= list.booth_count) {
    return list.booth_rate_cents;
  }
  return Math.round(clientBoothRateCents);
}

/** Hydrate form rows from DB (selections JSON or legacy package_key). */
export function packageSelectionsFromContract(contract: {
  package_key?: string | null;
  package_selections?: unknown;
}): BigSmokePackageSelection[] {
  if (Array.isArray(contract.package_selections)) {
    const normalized = normalizeBigSmokePackageSelections(
      contract.package_selections as Array<{ key?: string | null; qty?: number | null }>,
    );
    if (normalized.length > 0) return normalized;
  }
  if (isBigSmokePackageKey(contract.package_key)) {
    return [{ key: contract.package_key, qty: 1 }];
  }
  return [];
}
