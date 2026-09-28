/**
 * NYWE bills E. & J. Gallo's wineries on one vendor license.
 * The contract total is one license fee per winery (Louis M. Martini, Massican, …).
 */

export const NYWE_GALLO_CONTRACT_NAME = 'Gallo';

export const NYWE_COMBINED_MERGEABLE_STATUSES = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
] as const;

export type NyweCoveredSourceRow = {
  source_sheet_id: string;
  source_sheet_tab: string;
  source_row_number: number;
};

export type NyweCoveredWinery = {
  winery_name: string;
  website_url: string | null;
  wine_display: string | null;
  source_rows: NyweCoveredSourceRow[];
};

export type CombinedRosterWineryInput = {
  wineryName: string;
  billingCompany: string;
  wineDisplay: string | null;
  websiteUrl: string | null;
  source_sheet_id: string;
  source_sheet_tab: string;
  source_row_number: number;
};

const GALLO_BILLING_KEYS = new Set([
  'gallo',
  'ej gallo',
  'e j gallo',
  'e and j gallo',
  'e and j gallo winery',
  'e and j gallo winery inc',
  'e and j gallo winery llc',
]);

/** Known Gallo brand names on the NYWE roster — qualify even when legal name is the winery. */
const GALLO_BRAND_KEYS = new Set([
  'louis m martini',
  'louis martini',
  'massican',
  'pahlmeyer',
  'rombauer',
  'rombauer vineyards',
  'jermann',
]);

export function normalizeNyweBillingKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Billing parent for the combined NYWE license — not an individual Gallo brand. */
export function isGalloBillingCompany(name: string | null | undefined): boolean {
  const key = normalizeNyweBillingKey(name);
  if (!key) return false;
  if (GALLO_BILLING_KEYS.has(key)) return true;
  if (/^e and j gallo\b/.test(key)) return true;
  if (/^ej gallo\b/.test(key)) return true;
  return false;
}

export function isGalloBrandWinery(name: string | null | undefined): boolean {
  const key = normalizeNyweBillingKey(name);
  if (!key) return false;
  if (GALLO_BRAND_KEYS.has(key)) return true;
  if (/^louis m? ?martini\b/.test(key)) return true;
  if (/^rombauer\b/.test(key)) return true;
  return false;
}

export function isGalloSignerEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? '';
  return value.endsWith('@ejgallo.com') || value.endsWith('@gallo.com');
}

export function coveredWineryKey(name: string | null | undefined): string {
  return normalizeNyweBillingKey(name);
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function sourceRowFromUnknown(value: unknown): NyweCoveredSourceRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const source_sheet_id = stringOrNull(row.source_sheet_id);
  const source_sheet_tab = stringOrNull(row.source_sheet_tab);
  const source_row_number =
    typeof row.source_row_number === 'number' && Number.isFinite(row.source_row_number)
      ? row.source_row_number
      : null;
  if (!source_sheet_id || !source_sheet_tab || source_row_number == null || source_row_number < 2) {
    return null;
  }
  return { source_sheet_id, source_sheet_tab, source_row_number };
}

function sameSourceRow(a: NyweCoveredSourceRow, b: NyweCoveredSourceRow): boolean {
  return (
    a.source_sheet_id === b.source_sheet_id &&
    a.source_sheet_tab === b.source_sheet_tab &&
    a.source_row_number === b.source_row_number
  );
}

function mergeWineDisplay(current: string | null, incoming: string | null): string | null {
  const left = current?.trim() || '';
  const right = incoming?.trim() || '';
  if (!left) return right || null;
  if (!right || left === right || left.includes(right)) return left;
  if (right.includes(left)) return right;
  return `${left}; ${right}`;
}

function mergeSourceRows(
  current: NyweCoveredSourceRow[],
  incoming: NyweCoveredSourceRow[],
): NyweCoveredSourceRow[] {
  const rows = [...current];
  for (const row of incoming) {
    if (!rows.some((existing) => sameSourceRow(existing, row))) rows.push(row);
  }
  return rows;
}

export function emptyCoveredWinery(wineryName: string): NyweCoveredWinery {
  return {
    winery_name: wineryName.trim(),
    website_url: null,
    wine_display: null,
    source_rows: [],
  };
}

export function parseCoveredWineries(raw: unknown): NyweCoveredWinery[] {
  if (!Array.isArray(raw)) return [];
  const parsed: NyweCoveredWinery[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const winery_name = stringOrNull(row.winery_name);
    if (!winery_name || isGalloBillingCompany(winery_name)) continue;
    const source_rows = Array.isArray(row.source_rows)
      ? row.source_rows.map(sourceRowFromUnknown).filter((entry): entry is NyweCoveredSourceRow => entry != null)
      : [];
    const legacy = sourceRowFromUnknown(row);
    if (legacy) source_rows.push(legacy);
    parsed.push({
      winery_name,
      website_url: stringOrNull(row.website_url),
      wine_display: stringOrNull(row.wine_display),
      source_rows,
    });
  }
  return dedupeCoveredWineries(parsed);
}

export function dedupeCoveredWineries(rows: NyweCoveredWinery[]): NyweCoveredWinery[] {
  const byKey = new Map<string, NyweCoveredWinery>();
  for (const row of rows) {
    const winery_name = row.winery_name.trim();
    const key = coveredWineryKey(winery_name);
    if (!key || isGalloBillingCompany(winery_name)) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        winery_name,
        website_url: row.website_url?.trim() || null,
        wine_display: row.wine_display?.trim() || null,
        source_rows: mergeSourceRows([], row.source_rows ?? []),
      });
      continue;
    }
    byKey.set(key, {
      winery_name: existing.winery_name,
      website_url: existing.website_url || row.website_url?.trim() || null,
      wine_display: mergeWineDisplay(existing.wine_display, row.wine_display),
      source_rows: mergeSourceRows(existing.source_rows, row.source_rows ?? []),
    });
  }
  return [...byKey.values()].sort((a, b) =>
    a.winery_name.localeCompare(b.winery_name, undefined, { sensitivity: 'base' }),
  );
}

export function brandsPouredFromCoveredWineries(rows: NyweCoveredWinery[]): string | null {
  if (rows.length === 0) return null;
  return rows
    .map((row) => (row.wine_display ? `${row.winery_name} — ${row.wine_display}` : row.winery_name))
    .join('\n');
}

export function formatCoveredWineriesList(rows: NyweCoveredWinery[]): string {
  return rows.map((row) => row.winery_name).join(', ');
}

export function coveredWinerySourceKeys(rows: NyweCoveredWinery[]): string[] {
  const keys: string[] = [];
  for (const winery of rows) {
    for (const row of winery.source_rows) {
      keys.push(`${row.source_sheet_id}|${row.source_sheet_tab}|${row.source_row_number}`);
    }
  }
  return keys;
}

export function wineriesFromContract(contract: {
  exhibitor_company_name?: string | null;
  exhibitor_website_url?: string | null;
  brands_poured?: string | null;
  source_sheet_id?: string | null;
  source_sheet_tab?: string | null;
  source_row_number?: number | null;
  covered_wineries?: unknown;
}): NyweCoveredWinery[] {
  const covered = parseCoveredWineries(contract.covered_wineries);
  if (covered.length > 0) return covered;
  const name = contract.exhibitor_company_name?.trim() ?? '';
  if (!name || isGalloBillingCompany(name)) return [];
  const source = sourceRowFromUnknown({
    source_sheet_id: contract.source_sheet_id,
    source_sheet_tab: contract.source_sheet_tab,
    source_row_number: contract.source_row_number,
  });
  return [
    {
      winery_name: name,
      website_url: contract.exhibitor_website_url?.trim() || null,
      wine_display: contract.brands_poured?.trim() || null,
      source_rows: source ? [source] : [],
    },
  ];
}

export function contractQualifiesForGalloCombine(contract: {
  exhibitor_legal_name?: string | null;
  exhibitor_company_name?: string | null;
  signer_1_email?: string | null;
  covered_wineries?: unknown;
}): boolean {
  if (isGalloBillingCompany(contract.exhibitor_legal_name)) return true;
  if (isGalloBillingCompany(contract.exhibitor_company_name)) return true;
  if (isGalloBrandWinery(contract.exhibitor_company_name)) return true;
  if (isGalloBrandWinery(contract.exhibitor_legal_name)) return true;
  if (isGalloSignerEmail(contract.signer_1_email)) return true;
  const covered = parseCoveredWineries(contract.covered_wineries);
  if (covered.some((winery) => isGalloBrandWinery(winery.winery_name))) return true;
  return covered.length > 0 && isGalloBillingCompany(contract.exhibitor_legal_name);
}

export function isCombinedGalloContract(contract: {
  exhibitor_company_name?: string | null;
  exhibitor_legal_name?: string | null;
  covered_wineries?: unknown;
}): boolean {
  if (parseCoveredWineries(contract.covered_wineries).length > 1) return true;
  return (
    isGalloBillingCompany(contract.exhibitor_company_name) &&
    isGalloBillingCompany(contract.exhibitor_legal_name)
  );
}

export function canMergeNyweContract(contract: {
  status: string;
  sent_at?: string | null;
  docusign_envelope_id?: string | null;
}): boolean {
  if (contract.sent_at || contract.docusign_envelope_id) return false;
  return (NYWE_COMBINED_MERGEABLE_STATUSES as readonly string[]).includes(contract.status);
}

/** One license fee per distinct winery. A single winery stays at the flat NYWE fee. */
export function nyweCombinedLicensePricing(
  feeCents: number,
  wineryCount: number,
): { booth_count: number; booth_rate_cents: number } {
  const count = Math.max(1, Math.min(40, Math.floor(wineryCount) || 1));
  return { booth_count: count, booth_rate_cents: feeCents };
}

export function galloContractFieldsFromWineries(input: {
  legalName: string;
  companyName: string;
  wineries: NyweCoveredWinery[];
  feeCents: number;
}): {
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  brands_poured: string | null;
  covered_wineries: NyweCoveredWinery[] | null;
  booth_count: number;
  booth_rate_cents: number;
} {
  const wineries = dedupeCoveredWineries(input.wineries);
  const count = Math.max(1, wineries.length);
  const pricing = nyweCombinedLicensePricing(input.feeCents, count);
  const legalName = input.legalName.trim();
  return {
    exhibitor_legal_name: isGalloBillingCompany(legalName) ? legalName : 'GALLO',
    exhibitor_company_name:
      wineries.length > 1 ? NYWE_GALLO_CONTRACT_NAME : (wineries[0]?.winery_name || input.companyName.trim() || NYWE_GALLO_CONTRACT_NAME),
    brands_poured: brandsPouredFromCoveredWineries(wineries) || input.companyName.trim() || null,
    covered_wineries: wineries.length > 0 ? wineries : null,
    booth_count: pricing.booth_count,
    booth_rate_cents: pricing.booth_rate_cents,
  };
}

export function primarySourceRow(wineries: NyweCoveredWinery[]): NyweCoveredSourceRow | null {
  for (const winery of wineries) {
    if (winery.source_rows[0]) return winery.source_rows[0];
  }
  return null;
}

/** Signer and Modesto billing used when a Gallo draft does not already have them. */
export const NYWE_GALLO_ORDER_DEFAULTS = {
  signer_1_name: 'Lon Gallagher',
  signer_1_email: 'lon.gallagher@ejgallo.com',
  event_contact_name: 'Emma Bovberg',
  event_contact_email: 'emma.bovberg@ejgallo.com',
  billing_contact_name: 'Emma Bovberg',
  billing_contact_email: 'emma.bovberg@ejgallo.com',
  billing_address_line1: '600 Yosemite Blvd',
  billing_city: 'Modesto',
  billing_state: 'CA',
  billing_zip: '95354',
  exhibitor_address_line1: '600 Yosemite Blvd',
  exhibitor_city: 'Modesto',
  exhibitor_state: 'CA',
  exhibitor_zip: '95354',
} as const;

const GALLO_ORDER_PARTY_KEYS = [
  'signer_1_name',
  'signer_1_email',
  'event_contact_name',
  'event_contact_email',
  'billing_contact_name',
  'billing_contact_email',
  'billing_address_line1',
  'billing_address_line2',
  'billing_city',
  'billing_state',
  'billing_zip',
  'billing_country',
  'exhibitor_address_line1',
  'exhibitor_address_line2',
  'exhibitor_city',
  'exhibitor_state',
  'exhibitor_zip',
  'exhibitor_country',
] as const;

export type GalloOrderPartyKey = (typeof GALLO_ORDER_PARTY_KEYS)[number];

type GalloOrderParty = Partial<Record<GalloOrderPartyKey, string | null>>;

function partyValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Fill only empty signer, event contact, and address fields.
 * Sibling drafts win; the known Gallo order fills anything still blank.
 */
export function blankGalloPartyPatch(
  current: GalloOrderParty,
  donors: GalloOrderParty[],
): Partial<Record<GalloOrderPartyKey, string>> & { billing_same_as_corporate?: false } {
  const patch: Partial<Record<GalloOrderPartyKey, string>> & { billing_same_as_corporate?: false } = {};
  for (const key of GALLO_ORDER_PARTY_KEYS) {
    if (partyValue(current[key])) continue;
    const donated = donors.map((donor) => partyValue(donor[key])).find((value): value is string => Boolean(value));
    const fallback = key in NYWE_GALLO_ORDER_DEFAULTS ? NYWE_GALLO_ORDER_DEFAULTS[key as keyof typeof NYWE_GALLO_ORDER_DEFAULTS] : null;
    const value = donated ?? fallback;
    if (value) patch[key] = value;
  }
  if (patch.billing_address_line1) patch.billing_same_as_corporate = false;
  return patch;
}

export function applyRosterRowsToCombinedContract(
  existing: NyweCoveredWinery[],
  rows: CombinedRosterWineryInput[],
  options: { locked: boolean },
): NyweCoveredWinery[] {
  let next = dedupeCoveredWineries(existing);
  for (const row of rows) {
    const wineryName = row.wineryName.trim();
    if (!wineryName || isGalloBillingCompany(wineryName)) continue;
    if (row.billingCompany.trim() && !isGalloBillingCompany(row.billingCompany) && !isGalloBillingCompany(wineryName)) {
      continue;
    }
    const source = sourceRowFromUnknown(row);
    const incoming = emptyCoveredWinery(wineryName);
    incoming.website_url = row.websiteUrl?.trim() || null;
    incoming.wine_display = row.wineDisplay?.trim() || null;
    incoming.source_rows = source ? [source] : [];
    const key = coveredWineryKey(wineryName);
    const current = next.find((winery) => coveredWineryKey(winery.winery_name) === key);
    if (!current && options.locked) continue;
    next = dedupeCoveredWineries([...next, incoming]);
  }
  return next;
}

/** Fields to persist when this NYWE contract is the Gallo license. Null for every other exhibitor. */
export function galloWriteFromNames(input: {
  legalName: string;
  companyName: string;
  covered: unknown;
  feeCents: number;
}): ReturnType<typeof galloContractFieldsFromWineries> | null {
  if (!isGalloBillingCompany(input.legalName) && !isGalloBillingCompany(input.companyName)) return null;
  const listed = parseCoveredWineries(input.covered);
  const company = input.companyName.trim();
  const wineries =
    listed.length > 0
      ? listed
      : company && !isGalloBillingCompany(company)
        ? [emptyCoveredWinery(company)]
        : [];
  return galloContractFieldsFromWineries({
    legalName: input.legalName,
    companyName: input.companyName,
    wineries,
    feeCents: input.feeCents,
  });
}

/** Sent Gallo licenses that can be voided and folded into one combined order. */
export const NYWE_GALLO_VOIDABLE_STATUSES = ['sent', 'partially_signed', 'error'] as const;

export function canVoidNyweGalloContractForCombine(contract: {
  status: string;
  sent_at?: string | null;
  docusign_envelope_id?: string | null;
}): boolean {
  if ((NYWE_GALLO_VOIDABLE_STATUSES as readonly string[]).includes(contract.status)) return true;
  // Sent without a status sync still blocks combine until the envelope is voided.
  return Boolean(contract.sent_at || contract.docusign_envelope_id) && contract.status !== 'executed';
}

export type GalloDashboardLine = {
  id: string;
  wineryName: string;
  status: string;
  totalCents: number;
};

export type GalloDashboardSummary = {
  unsent: GalloDashboardLine[];
  sent: GalloDashboardLine[];
  needsVoid: boolean;
  alreadyCombined: boolean;
  combinedContractId: string | null;
  wineryNames: string[];
  totalCents: number;
  feeCents: number;
};

function lineFromContract(contract: {
  id: string;
  exhibitor_company_name: string;
  status: string;
  booth_count: number;
  booth_rate_cents: number;
  grand_total_cents?: number | null;
}): GalloDashboardLine {
  return {
    id: contract.id,
    wineryName: contract.exhibitor_company_name,
    status: contract.status,
    totalCents: contract.grand_total_cents ?? contract.booth_count * contract.booth_rate_cents,
  };
}

function wineryNamesFromContracts(
  contracts: {
    exhibitor_company_name: string;
    covered_wineries?: unknown;
  }[],
): string[] {
  return [
    ...new Set(
      contracts
        .flatMap((contract) => {
          const named = wineriesFromContract(contract).map((winery) => winery.winery_name);
          return named.length > 0 ? named : [contract.exhibitor_company_name];
        })
        .map((name) => name.trim())
        .filter((name) => name && !isGalloBillingCompany(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** What the NYWE dashboard should show for the one Gallo license. */
export function summarizeGalloForDashboard(
  contracts: {
    id: string;
    event_id: string;
    status: string;
    sent_at?: string | null;
    docusign_envelope_id?: string | null;
    exhibitor_company_name: string;
    exhibitor_legal_name: string;
    booth_count: number;
    booth_rate_cents: number;
    grand_total_cents?: number | null;
    covered_wineries?: unknown;
    signer_1_email?: string | null;
  }[],
  eventId: string | null,
  feeCents: number,
): GalloDashboardSummary | null {
  const open = contracts.filter(
    (contract) =>
      (eventId == null || contract.event_id === eventId) &&
      contract.status !== 'cancelled' &&
      contract.status !== 'voided' &&
      contractQualifiesForGalloCombine(contract),
  );
  const unsentContracts = open.filter((contract) => canMergeNyweContract(contract));
  const sentContracts = open.filter(
    (contract) => !canMergeNyweContract(contract) && canVoidNyweGalloContractForCombine(contract),
  );
  const executedNames = new Set(
    open
      .filter((contract) => contract.status === 'executed')
      .flatMap((contract) => wineriesFromContract(contract).map((winery) => coveredWineryKey(winery.winery_name))),
  );

  const wineryNames = wineryNamesFromContracts([...unsentContracts, ...sentContracts]).filter(
    (name) => !executedNames.has(coveredWineryKey(name)),
  );

  if (wineryNames.length === 0) return null;

  const alreadyCombined =
    unsentContracts.length === 1 && sentContracts.length === 0 && wineryNames.length > 1;
  const needsVoid = sentContracts.length > 0;
  // One unsent single-winery draft alone does not need a card unless sent siblings exist.
  if (!needsVoid && !alreadyCombined && unsentContracts.length < 2 && wineryNames.length < 2) {
    return null;
  }

  const combined = alreadyCombined ? unsentContracts[0]! : null;
  const totalCents = alreadyCombined
    ? (combined?.grand_total_cents ?? wineryNames.length * feeCents)
    : wineryNames.length * feeCents;

  return {
    unsent: unsentContracts.map(lineFromContract).sort((a, b) => a.wineryName.localeCompare(b.wineryName, undefined, { sensitivity: 'base' })),
    sent: sentContracts.map(lineFromContract).sort((a, b) => a.wineryName.localeCompare(b.wineryName, undefined, { sensitivity: 'base' })),
    needsVoid,
    alreadyCombined,
    combinedContractId: combined?.id ?? null,
    wineryNames,
    totalCents,
    feeCents,
  };
}

export function exhibitorCompanyMergeValue(contract: {
  exhibitor_company_name: string;
  covered_wineries?: unknown;
}): string {
  const covered = parseCoveredWineries(contract.covered_wineries);
  if (covered.length <= 1) return contract.exhibitor_company_name;
  return `${contract.exhibitor_company_name} (${formatCoveredWineriesList(covered)})`;
}
