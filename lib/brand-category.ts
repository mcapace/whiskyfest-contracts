/** Spirit / product categories for brand mix, filters, and sponsor directory. */
export const BRAND_CATEGORIES = [
  'Bourbon',
  'Scotch',
  'Irish',
  'Japanese',
  'Rye',
  'World Whiskies',
  'Tequila',
  'Vodka',
  'Gin',
  'Rum',
  'Cigar',
  'Other',
] as const;

export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

function norm(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Classify a poured brand (and optional exhibitor company) into a dashboard category.
 * Uses brand name first; company name helps when the booth brand omits category words (e.g. Oliva).
 */
export function categorizeBrandFromName(brandName: string, exhibitorCompany?: string | null): BrandCategory {
  const brand = norm(brandName);
  const company = norm(exhibitorCompany ?? '');
  const blob = `${brand} ${company}`.trim();
  if (!blob) return 'Other';

  if (
    /\bcigar(s)?\b/.test(blob) ||
    /\boliva\b/.test(blob) ||
    /\bpadron\b/.test(blob) ||
    /\bdrew\s*estate\b/.test(blob) ||
    /\bmacanudo\b/.test(blob) ||
    /\bcohiba\b/.test(blob) ||
    /\bdavidoff\b/.test(blob) ||
    /\brocky\s*patel\b/.test(blob) ||
    /\barturo\s*fuente\b/.test(blob)
  ) {
    return 'Cigar';
  }

  if (
    /\btequila\b/.test(blob) ||
    /\bmezcal\b/.test(blob) ||
    /\bdon\s*julio\b/.test(blob) ||
    /\bpatr[oó]n\b/.test(blob) ||
    /\bcasamigos\b/.test(blob) ||
    /\bhornitos\b/.test(blob) ||
    /\bel\s*jimador\b/.test(blob) ||
    /\bclase\s*azul\b/.test(blob)
  ) {
    return 'Tequila';
  }

  if (/\bvodka\b/.test(blob) || /\bgrey\s*goose\b/.test(blob) || /\bbelvedere\b/.test(blob) || /\bketel\s*one\b/.test(blob)) {
    return 'Vodka';
  }

  if (/\bgin\b/.test(blob) || /\bbombay\b/.test(blob) || /\btanqueray\b/.test(blob) || /\bhendrick'?s\b/.test(blob)) {
    return 'Gin';
  }

  if (/\brum\b/.test(blob) || /\bbacardi\b/.test(blob) || /\bzacapa\b/.test(blob) || /\bmount\s*gay\b/.test(blob)) {
    return 'Rum';
  }

  if (/\bbourbon\b/.test(blob) || /\bmaker'?s\s*mark\b/.test(blob) || /\bbuffalo\s*trace\b/.test(blob) || /\bwoodford\b/.test(blob)) {
    return 'Bourbon';
  }

  if (
    /\bscotch\b/.test(blob) ||
    /\bhighland\b/.test(blob) ||
    /\bspeyside\b/.test(blob) ||
    /\bislay\b/.test(blob) ||
    /\bmacallan\b/.test(blob) ||
    /\bglenfiddich\b/.test(blob) ||
    /\blaphroaig\b/.test(blob)
  ) {
    return 'Scotch';
  }

  if (/\birish\b/.test(blob) || /\b(jameson|redbreast|bushmills)\b/.test(blob)) {
    return 'Irish';
  }

  if (/\bjapanese\b/.test(blob) || /\bjapan\b/.test(blob) || /\bsuntory\b/.test(blob) || /\bnikka\b/.test(blob) || /\byamazaki\b/.test(blob)) {
    return 'Japanese';
  }

  if (/\brye\b/.test(blob) || /\b(whistlepig|bulleit\s*rye)\b/.test(blob)) {
    return 'Rye';
  }

  if (
    /\bworld\b/.test(blob) ||
    /\bcanad(a|ian)\b/.test(blob) ||
    /\btaiwan\b/.test(blob) ||
    /\bindia(n)?\b/.test(blob) ||
    /\baustralia(n)?\b/.test(blob) ||
    /\bcrown\s*royal\b/.test(blob)
  ) {
    return 'World Whiskies';
  }

  return 'Other';
}

/** Legacy free-text brands_poured field (comma/newline separated). */
export function parseBrandNamesFromBrandsPoured(brandsPoured: string | null | undefined): string[] {
  return (brandsPoured ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Primary category for filters when only brands_poured text is available. */
export function categorizeBrandsPoured(
  brandsPoured: string | null | undefined,
  exhibitorCompany?: string | null,
): BrandCategory {
  const names = parseBrandNamesFromBrandsPoured(brandsPoured);
  if (names.length === 0) return categorizeBrandFromName('', exhibitorCompany);
  return categorizeBrandFromName(names[0]!, exhibitorCompany);
}

/** Category for a contract using booth brand rows when present, else brands_poured. */
export function categorizeContractBrands(
  contract: { brands_poured?: string | null; exhibitor_company_name?: string | null },
  boothBrandNames: string[],
): BrandCategory {
  const names = boothBrandNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    return categorizeBrandsPoured(contract.brands_poured, contract.exhibitor_company_name);
  }
  return categorizeBrandFromName(names[0]!, contract.exhibitor_company_name);
}

export function brandsPouredSummaryFromBoothBrandNames(brandNames: string[]): string | null {
  const names = brandNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return null;
  return names.join(', ');
}
