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

/** Ordered rules: first match wins. */
const CATEGORY_RULES: { category: BrandCategory; pattern: RegExp }[] = [
  {
    category: 'Cigar',
    pattern:
      /\b(cigar(s)?|oliva|padron|drew\s*estate|macanudo|cohiba|davidoff|rocky\s*patel|arturo\s*fuente|ashton|perdomo|la\s*gloria\s*cubana)\b/i,
  },
  {
    category: 'Tequila',
    pattern:
      /\b(tequila|mezcal|don\s*julio|patr[oó]n|casamigos|hornitos|el\s*jimador|clase\s*azul|herradura|espol[oó]n|fortaleza|teremana|1800|herradura)\b/i,
  },
  {
    category: 'Vodka',
    pattern: /\b(vodka|grey\s*goose|belvedere|ketel\s*one|tito'?s|ciroc|stolichnaya|absolut|chopin)\b/i,
  },
  {
    category: 'Gin',
    pattern: /\b(gin|bombay|tanqueray|hendrick'?s|beefeater|plymouth\s*gin|aviation\s*gin)\b/i,
  },
  {
    category: 'Rum',
    pattern: /\b(\brum\b|bacardi|zacapa|mount\s*gay|appleton|diplomatico|plantation\s*rum|havana\s*club)\b/i,
  },
  {
    category: 'Bourbon',
    pattern:
      /\b(bourbon|maker'?s\s*mark|buffalo\s*trace|woodford|wild\s*turkey|jim\s*beam|knob\s*creek|four\s*roses|bulleit(?!\s*rye)|eagle\s*rare|basil\s*hayden|booker'?s|blanton'?s|angel'?s\s*envy|old\s*forester|willett|heaven\s*hill|evan\s*williams|elijah\s*craig)\b/i,
  },
  {
    category: 'Scotch',
    pattern:
      /\b(scotch|single\s*malt|highland|speyside|islay|macallan|glenfiddich|glenlivet|laphroaig|lagavulin|ardbeg|bowmore|talisker|oban|springbank|bruichladdich|balvenie|dalmore|auchentoshan|johnnie\s*walker|chivas|dewar'?s)\b/i,
  },
  {
    category: 'Irish',
    pattern: /\b(irish|jameson|redbreast|bushmills|tullamore|powers|green\s*spot|yellow\s*spot|midleton)\b/i,
  },
  {
    category: 'Japanese',
    pattern:
      /\b(japanese|japan|suntory|nikka|yamazaki|hakushu|hibiki|miyagikyo|yoichi|chichibu|kaiyo|shinshu)\b/i,
  },
  {
    category: 'Rye',
    pattern: /\b(\brye\b|rye\s*whisk(e)?y|whistlepig|bulleit\s*rye|rittenhouse|pikesville|sazerac\s*rye|templeton)\b/i,
  },
  {
    category: 'World Whiskies',
    pattern:
      /\b(world\s*whisk(e)?y|canadian|canada\s*club|crown\s*royal|seagram|taiwan|kavalan|indian|amrut|australia|sullivan'?s\s*cove|pendleton)\b/i,
  },
];

/**
 * Classify from brand name, exhibitor company, expressions, and optional saved category.
 */
export function resolveBrandCategory(input: {
  brandName: string;
  exhibitorCompany?: string | null;
  expressions?: string[];
  savedCategory?: string | null;
}): BrandCategory {
  const saved = input.savedCategory?.trim();
  if (saved && BRAND_CATEGORIES.includes(saved as BrandCategory)) {
    return saved as BrandCategory;
  }

  const blob = [
    input.brandName,
    input.exhibitorCompany ?? '',
    ...(input.expressions ?? []),
  ]
    .map(norm)
    .filter(Boolean)
    .join(' ');

  if (!blob) return 'Other';

  for (const { category, pattern } of CATEGORY_RULES) {
    if (pattern.test(blob)) return category;
  }

  return 'Other';
}

/** @deprecated Use resolveBrandCategory */
export function categorizeBrandFromName(
  brandName: string,
  exhibitorCompany?: string | null,
  expressions?: string[],
): BrandCategory {
  return resolveBrandCategory({ brandName, exhibitorCompany, expressions });
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
  if (names.length === 0) return resolveBrandCategory({ brandName: '', exhibitorCompany });
  return resolveBrandCategory({ brandName: names[0]!, exhibitorCompany });
}

/** Category for a contract using booth brand rows when present, else brands_poured. */
export function categorizeContractBrands(
  contract: { brands_poured?: string | null; exhibitor_company_name?: string | null },
  boothRows: { brand_name: string; brand_category?: string | null; expressions?: string[] }[],
): BrandCategory {
  const rows = boothRows.filter((r) => r.brand_name?.trim());
  if (rows.length === 0) {
    return categorizeBrandsPoured(contract.brands_poured, contract.exhibitor_company_name);
  }
  const first = rows[0]!;
  return resolveBrandCategory({
    brandName: first.brand_name,
    exhibitorCompany: contract.exhibitor_company_name,
    expressions: first.expressions,
    savedCategory: first.brand_category,
  });
}

export function brandsPouredSummaryFromBoothBrandNames(brandNames: string[]): string | null {
  const names = brandNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return null;
  return names.join(', ');
}

export function suggestBrandCategory(
  brandName: string,
  exhibitorCompany?: string | null,
  expressions?: string[],
): BrandCategory {
  return resolveBrandCategory({ brandName, exhibitorCompany, expressions });
}
