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

function parseDataRow(row: string[], a: string): Omit<LiveSheetPipelineRow, 'section'> | null {
  const company = cell(row, 1);
  if (!company || isHeaderOrTotal(company, a)) return null;

  const brands = cell(row, 2);
  const booths = parseBoothCount(cell(row, 3));
  const rate = parseMoneyToCents(cell(row, 4));
  const spend = parseMoneyToCents(cell(row, 6));
  const notes = cell(row, 7);
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

  for (const row of values) {
    const a = cell(row, 0);
    const detected = detectSection(a);
    if (detected === 'pending' || detected === 'new_business' || detected === 'confirmed') {
      section = detected;
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
    if (aUp === 'SALES REP') continue;

    const parsed = parseDataRow(row, a);
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
      range: `'${tab.replace(/'/g, "''")}'!A1:I120`,
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
