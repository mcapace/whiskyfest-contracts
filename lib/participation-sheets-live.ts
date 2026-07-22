import { getSheetsClient } from '@/lib/sheets-tracker';
import {
  normalizeCompanyKey,
  parseBoothCount,
  parseMoneyToCents,
  resolveRepEmailFromInitials,
  type PipelineSection,
} from '@/lib/participation-report-shared';

/**
 * WhiskyFest & Tequila 2026 participation sheet (Marvin layout):
 * CONFIRMED / PENDING RENEWALS / NEW BUSINESS.
 */
export const PARTICIPATION_MARVIN_SHEET_ID =
  process.env['SHEETS_PARTICIPATION_MARVIN_ID']?.trim() ||
  '10Wmm1V2B0z8olqutieFCM8iJeFCudEWHars6YPrv7GY';

/** @deprecated Kept for env compatibility — pending now uses Marvin sheet. */
export const PARTICIPATION_PENDING_SHEET_ID =
  process.env['SHEETS_PARTICIPATION_PENDING_ID']?.trim() || PARTICIPATION_MARVIN_SHEET_ID;

export type LiveSheetPipelineRow = {
  section: PipelineSection;
  company_name: string;
  rep_initials: string;
  brands_text: string;
  booth_count: number;
  rate_per_booth_cents: number;
  total_spend_cents: number;
  sheet_notes: string;
  rsvp: string;
};

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

type MarvinSection = 'pending' | 'new_business' | null;

function detectSection(firstCol: string): MarvinSection | 'skip' {
  const a = firstCol.toUpperCase();
  if (a.includes('PENDING RENEWAL')) return 'pending';
  if (a.includes('NEW BUSINESS')) return 'new_business';
  if (a.includes('CONFIRMED') || a.includes('TOTAL CONFIRMED')) return 'skip';
  return null;
}

/**
 * Pull pending renewals + new business live from WhiskyFest & Tequila 2026 sheet.
 * Pending accounts and Notes come from the PENDING RENEWALS block.
 */
export async function fetchLiveParticipationSheetRows(): Promise<{
  pending: LiveSheetPipelineRow[];
  newBusiness: LiveSheetPipelineRow[];
  fetchedAt: string;
  sources: { pendingSheetId: string; marvinSheetId: string };
}> {
  const sheets = getSheetsClient();
  const marvinSheetId = PARTICIPATION_MARVIN_SHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: marvinSheetId });
  const tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
  const marvinRes = await sheets.spreadsheets.values.get({
    spreadsheetId: marvinSheetId,
    range: `'${tab.replace(/'/g, "''")}'!A1:I120`,
  });

  const pending: LiveSheetPipelineRow[] = [];
  const newBusiness: LiveSheetPipelineRow[] = [];
  const seenPending = new Set<string>();
  const seenNew = new Set<string>();

  let section: 'pending' | 'new_business' | null = null;

  for (const row of (marvinRes.data.values ?? []) as string[][]) {
    const a = cell(row, 0);
    const detected = detectSection(a);
    if (detected === 'pending' || detected === 'new_business') {
      section = detected;
      continue;
    }
    if (detected === 'skip') {
      // Leaving CONFIRMED / grand total headers — only clear section on CONFIRMED start
      if (a.toUpperCase().includes('CONFIRMED') && !a.toUpperCase().includes('PENDING')) {
        section = null;
      }
      continue;
    }
    if (!section) continue;

    const aUp = a.toUpperCase();
    if (aUp === 'TOTAL' || aUp.startsWith('TOTAL ') || aUp.includes('CONFIRMED + PENDING')) {
      section = null;
      continue;
    }
    if (aUp === 'SALES REP') continue;

    const company = cell(row, 1);
    if (!company || isHeaderOrTotal(company, a)) continue;
    const key = normalizeCompanyKey(company);

    const brands = cell(row, 2);
    const booths = parseBoothCount(cell(row, 3));
    const rate = parseMoneyToCents(cell(row, 4));
    const spend = parseMoneyToCents(cell(row, 6));
    // Notes column (H) on PENDING RENEWALS / sometimes NEW BUSINESS
    const notes = cell(row, 7);

    if (section === 'pending') {
      if (seenPending.has(key)) continue;
      seenPending.add(key);
      const rateCents = rate || (booths > 0 && spend > 0 ? Math.round(spend / booths) : 1_500_000);
      pending.push({
        section: 'pending_renewal',
        company_name: company,
        rep_initials: a || '—',
        brands_text: brands,
        booth_count: booths,
        rate_per_booth_cents: rateCents,
        total_spend_cents: spend || (booths > 0 ? booths * rateCents : 0),
        sheet_notes: notes,
        rsvp: '',
      });
      continue;
    }

    if (seenNew.has(key)) continue;
    seenNew.add(key);
    newBusiness.push({
      section: 'new_business',
      company_name: company,
      rep_initials: a || '—',
      brands_text: brands,
      booth_count: booths,
      rate_per_booth_cents: rate,
      total_spend_cents: spend,
      sheet_notes: notes || brands,
      rsvp: '',
    });
  }

  return {
    pending,
    newBusiness,
    fetchedAt: new Date().toISOString(),
    sources: { pendingSheetId: marvinSheetId, marvinSheetId },
  };
}

export function resolveRepIdFromInitials(
  initials: string,
  repByEmail: Map<string, string>,
): string | null {
  const email = resolveRepEmailFromInitials(initials);
  if (!email) return null;
  return repByEmail.get(email) ?? null;
}
