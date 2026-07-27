import { getSheetsClient } from '@/lib/sheets-tracker';
import { isGoogleSheetsQuotaError } from '@/lib/roster-sheets-pull-policy';
import {
  normalizeCompanyKey,
  parseBoothCount,
  parseMoneyToCents,
  resolveRepEmailFromInitials,
  type PipelineSection,
} from '@/lib/participation-report-shared';

/**
 * Sole source for Pending renewals + New business:
 * https://docs.google.com/spreadsheets/d/10Wmm1V2B0z8olqutieFCM8iJeFCudEWHars6YPrv7GY
 * (WhiskyFest & Tequila 2026 — Marvin)
 */
export const PARTICIPATION_MARVIN_SHEET_ID = '10Wmm1V2B0z8olqutieFCM8iJeFCudEWHars6YPrv7GY';

/** Keep Sheets reads under the per-minute quota (page loads + exports share this cache). */
const LIVE_SHEETS_CACHE_TTL_MS = 5 * 60 * 1000;

export type LiveSheetPipelineRow = {
  /** Sheet block this row was parsed from. Confirmed block uses `'confirmed'`. */
  section: PipelineSection | 'confirmed';
  company_name: string;
  rep_initials: string;
  brands_text: string;
  booth_count: number;
  rate_per_booth_cents: number;
  total_spend_cents: number;
  sheet_notes: string;
  rsvp: string;
};

export type LiveParticipationSheetPayload = {
  pending: LiveSheetPipelineRow[];
  newBusiness: LiveSheetPipelineRow[];
  /** CONFIRMED block on Marvin — booth/spend reference for executed contracts. */
  confirmed: LiveSheetPipelineRow[];
  fetchedAt: string;
  sources: { marvinSheetId: string };
  fromCache: boolean;
  stale?: boolean;
};

type CacheEntry = {
  payload: Omit<LiveParticipationSheetPayload, 'fromCache' | 'stale'>;
  expiresAt: number;
};

let memoryCache: CacheEntry | null = null;
let cachedTabTitle: string | null = null;
let inflight: Promise<LiveParticipationSheetPayload> | null = null;

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').toString().trim();
}

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Marvin layout (2026): Sales Rep | Company | Brands | Booths 2025 | Booths 2026 | Rate | Sponsorship | Total Spend | Notes
 * Older single-booth layout had Rate in col E and Total Spend in col G — that mis-read 2026 booth counts as $.
 */
type ColumnMap = {
  company: number;
  brands: number;
  booths: number;
  rate: number;
  spend: number;
  notes: number;
};

/** Dual booth-year columns (current Marvin sheet). */
const DUAL_BOOTH_COLUMNS: ColumnMap = {
  company: 1,
  brands: 2,
  booths: 4,
  rate: 5,
  spend: 7,
  notes: 8,
};

/** Legacy single booths column (pre dual 2025/2026 headers). */
const LEGACY_COLUMNS: ColumnMap = {
  company: 1,
  brands: 2,
  booths: 3,
  rate: 4,
  spend: 6,
  notes: 7,
};

function findHeaderIndex(headers: string[], ...needles: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? '';
    if (needles.every((n) => h.includes(n))) return i;
  }
  return -1;
}

/** Build a column map from a "Sales Rep" header row; falls back to dual-booth layout. */
function columnMapFromHeaderRow(row: string[]): ColumnMap {
  const headers = row.map((c) => normalizeHeader(String(c ?? '')));
  if (!headers[0]?.includes('sales rep')) return DUAL_BOOTH_COLUMNS;

  const company = findHeaderIndex(headers, 'company');
  const brands = findHeaderIndex(headers, 'brand');
  // Prefer 2026 booths when both years exist; else any booths column.
  let booths = findHeaderIndex(headers, 'booth', '2026');
  if (booths < 0) booths = findHeaderIndex(headers, 'booth');
  const rate = findHeaderIndex(headers, 'rate');
  const spend = findHeaderIndex(headers, 'total spend');
  const notes = findHeaderIndex(headers, 'note');

  const hasDualBoothYears =
    findHeaderIndex(headers, 'booth', '2025') >= 0 && findHeaderIndex(headers, 'booth', '2026') >= 0;

  if (company < 0 || booths < 0 || rate < 0 || spend < 0) {
    return hasDualBoothYears ? DUAL_BOOTH_COLUMNS : LEGACY_COLUMNS;
  }

  return {
    company,
    brands: brands >= 0 ? brands : 2,
    booths,
    rate,
    spend,
    notes: notes >= 0 ? notes : spend + 1,
  };
}

function isHeaderOrTotal(company: string, firstCol: string): boolean {
  const c = company.toLowerCase();
  const a = firstCol.toLowerCase();
  if (!company && !firstCol) return true;
  if (c.includes('total') || a === 'total' || a.startsWith('total ')) return true;
  if (a === 'sales rep' || c === 'company') return true;
  if (a.includes('new business') || a.includes('pending renewal') || a.includes('confirmed')) return true;
  return false;
}

function detectSection(firstCol: string): 'pending' | 'new_business' | 'confirmed' | 'skip' | null {
  const a = firstCol.toUpperCase();
  if (a.includes('PENDING RENEWAL')) return 'pending';
  if (a.includes('NEW BUSINESS')) return 'new_business';
  // TOTAL CONFIRMED is a footer, not the company list header.
  if (a.includes('TOTAL CONFIRMED')) return 'skip';
  if (a.includes('CONFIRMED') && !a.includes('PENDING')) return 'confirmed';
  return null;
}

function parseDataRow(
  row: string[],
  a: string,
  cols: ColumnMap,
): Omit<LiveSheetPipelineRow, 'section'> | null {
  const company = cell(row, cols.company);
  if (!company || isHeaderOrTotal(company, a)) return null;

  const brands = cell(row, cols.brands);
  const booths = parseBoothCount(cell(row, cols.booths));
  const rate = parseMoneyToCents(cell(row, cols.rate));
  const spend = parseMoneyToCents(cell(row, cols.spend));
  const notes = cell(row, cols.notes);
  const rateCents = rate || (booths > 0 && spend > 0 ? Math.round(spend / booths) : 0);

  return {
    company_name: company,
    rep_initials: a || '—',
    brands_text: brands,
    booth_count: booths,
    rate_per_booth_cents: rateCents,
    total_spend_cents: spend || (booths > 0 && rateCents > 0 ? booths * rateCents : 0),
    sheet_notes: notes,
    rsvp: '',
  };
}

function parseMarvinRows(values: string[][]): {
  pending: LiveSheetPipelineRow[];
  newBusiness: LiveSheetPipelineRow[];
  confirmed: LiveSheetPipelineRow[];
} {
  const pending: LiveSheetPipelineRow[] = [];
  const newBusiness: LiveSheetPipelineRow[] = [];
  const confirmed: LiveSheetPipelineRow[] = [];
  const seenPending = new Set<string>();
  const seenNew = new Set<string>();
  const seenConfirmed = new Set<string>();

  let section: 'pending' | 'new_business' | 'confirmed' | null = null;
  let cols: ColumnMap = DUAL_BOOTH_COLUMNS;

  for (const row of values) {
    const a = cell(row, 0);
    const detected = detectSection(a);
    if (detected === 'pending' || detected === 'new_business' || detected === 'confirmed') {
      section = detected;
      cols = DUAL_BOOTH_COLUMNS;
      continue;
    }
    if (detected === 'skip') {
      section = null;
      continue;
    }
    if (!section) continue;

    const aUp = a.toUpperCase();
    if (aUp === 'TOTAL' || aUp.startsWith('TOTAL ') || aUp.includes('CONFIRMED + PENDING')) {
      section = null;
      continue;
    }
    if (aUp === 'SALES REP') {
      cols = columnMapFromHeaderRow(row);
      continue;
    }

    const parsed = parseDataRow(row, a, cols);
    if (!parsed) continue;
    const key = normalizeCompanyKey(parsed.company_name);

    if (section === 'pending') {
      if (seenPending.has(key)) continue;
      seenPending.add(key);
      const rateCents =
        parsed.rate_per_booth_cents ||
        (parsed.booth_count > 0 && parsed.total_spend_cents > 0
          ? Math.round(parsed.total_spend_cents / parsed.booth_count)
          : 1_500_000);
      pending.push({
        ...parsed,
        section: 'pending_renewal',
        rate_per_booth_cents: rateCents,
        total_spend_cents:
          parsed.total_spend_cents || (parsed.booth_count > 0 ? parsed.booth_count * rateCents : 0),
      });
      continue;
    }

    if (section === 'confirmed') {
      if (seenConfirmed.has(key)) continue;
      seenConfirmed.add(key);
      confirmed.push({
        ...parsed,
        section: 'confirmed',
      });
      continue;
    }

    if (seenNew.has(key)) continue;
    seenNew.add(key);
    newBusiness.push({
      ...parsed,
      section: 'new_business',
      sheet_notes: parsed.sheet_notes || parsed.brands_text,
    });
  }

  return { pending, newBusiness, confirmed };
}

async function resolveMarvinTabTitle(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
): Promise<string> {
  if (cachedTabTitle) return cachedTabTitle;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  cachedTabTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
  return cachedTabTitle;
}

async function pullMarvinValuesLive(): Promise<Omit<LiveParticipationSheetPayload, 'fromCache' | 'stale'>> {
  const sheets = getSheetsClient();
  const marvinSheetId = PARTICIPATION_MARVIN_SHEET_ID;

  const loadValues = async (tab: string) =>
    sheets.spreadsheets.values.get({
      spreadsheetId: marvinSheetId,
      range: `'${tab.replace(/'/g, "''")}'!A1:J120`,
    });

  // Prefer a single values.get. Only hit spreadsheets.get when the tab title is unknown.
  let tab = cachedTabTitle ?? (await resolveMarvinTabTitle(sheets, marvinSheetId));
  let marvinRes;
  try {
    marvinRes = await loadValues(tab);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isGoogleSheetsQuotaError(message)) throw err;

    // Tab may have been renamed — refresh title once and retry (not on quota errors).
    cachedTabTitle = null;
    tab = await resolveMarvinTabTitle(sheets, marvinSheetId);
    marvinRes = await loadValues(tab);
  }

  const { pending, newBusiness, confirmed } = parseMarvinRows(
    (marvinRes.data.values ?? []) as string[][],
  );
  return {
    pending,
    newBusiness,
    confirmed,
    fetchedAt: new Date().toISOString(),
    sources: { marvinSheetId },
  };
}

/**
 * Pending accounts + Notes and New business — live from WhiskyFest & Tequila 2026 only.
 * Results are cached in-memory for a few minutes to stay under Sheets API read quotas.
 */
export async function fetchLiveParticipationSheetRows(options?: {
  force?: boolean;
}): Promise<LiveParticipationSheetPayload> {
  const now = Date.now();
  if (!options?.force && memoryCache && memoryCache.expiresAt > now) {
    return { ...memoryCache.payload, fromCache: true };
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const payload = await pullMarvinValuesLive();
      memoryCache = {
        payload,
        expiresAt: Date.now() + LIVE_SHEETS_CACHE_TTL_MS,
      };
      return { ...payload, fromCache: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (memoryCache && isGoogleSheetsQuotaError(message)) {
        console.warn('[participation] Sheets quota hit — serving cached Marvin rows', message);
        return {
          ...memoryCache.payload,
          fromCache: true,
          stale: true,
        };
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function resolveRepIdFromInitials(
  initials: string,
  repByEmail: Map<string, string>,
): string | null {
  const email = resolveRepEmailFromInitials(initials);
  if (!email) return null;
  return repByEmail.get(email) ?? null;
}
