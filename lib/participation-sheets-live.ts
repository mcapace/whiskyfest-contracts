import { getSheetsClient } from '@/lib/sheets-tracker';
import {
  companiesMatch,
  normalizeCompanyKey,
  parseBoothCount,
  parseMoneyToCents,
  resolveRepEmailFromInitials,
  type PipelineSection,
} from '@/lib/participation-report-shared';

/** Live operational sheet (2025 FINAL + 2026 Master tabs). */
export const PARTICIPATION_PENDING_SHEET_ID =
  process.env['SHEETS_PARTICIPATION_PENDING_ID']?.trim() ||
  '1ARk-1UtWazPk9qwUUEU1JY-85oeyPhumi67CQ9YFNNo';

/** Marvin-style report sheet (New Business block). */
export const PARTICIPATION_MARVIN_SHEET_ID =
  process.env['SHEETS_PARTICIPATION_MARVIN_ID']?.trim() ||
  '10Wmm1V2B0z8olqutieFCM8iJeFCudEWHars6YPrv7GY';

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

type MasterOverlay = {
  rsvp: string;
  initials: string;
  brands: string;
  booths: number;
  spend: number;
  notes: string;
};

function parseMasterRows(rows: string[][]): Map<string, MasterOverlay> {
  const map = new Map<string, MasterOverlay>();
  for (const row of rows) {
    const company = cell(row, 3);
    if (!company || company.toLowerCase().includes('total')) continue;
    const overlay: MasterOverlay = {
      rsvp: cell(row, 0),
      initials: cell(row, 2),
      brands: cell(row, 5),
      booths: parseBoothCount(cell(row, 4)),
      spend: parseMoneyToCents(cell(row, 6)),
      // Status/Notes only — do not use Contract Recv'd (often just "Yes")
      notes: cell(row, 11),
    };
    map.set(normalizeCompanyKey(company), overlay);
    // Also index under raw lower for soft match later
  }
  return map;
}

function findMasterOverlay(company: string, master: Map<string, MasterOverlay>): MasterOverlay | null {
  const key = normalizeCompanyKey(company);
  if (master.has(key)) return master.get(key)!;
  for (const [k, v] of master) {
    if (companiesMatch(company, k) || companiesMatch(k, company)) return v;
  }
  return null;
}

/** Pull pending renewals (2025 Yes + 2026 Master overlay) and Marvin new business — live every call. */
export async function fetchLiveParticipationSheetRows(): Promise<{
  pending: LiveSheetPipelineRow[];
  newBusiness: LiveSheetPipelineRow[];
  fetchedAt: string;
  sources: { pendingSheetId: string; marvinSheetId: string };
}> {
  const sheets = getSheetsClient();
  const pendingSheetId = PARTICIPATION_PENDING_SHEET_ID;
  const marvinSheetId = PARTICIPATION_MARVIN_SHEET_ID;

  const [finalRes, masterRes, marvinRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: pendingSheetId,
      range: "'2025 FINAL List'!A3:N120",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: pendingSheetId,
      range: "'2026 Master List'!A3:N120",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: marvinSheetId,
      range: 'A1:H120',
    }),
  ]);

  const master = parseMasterRows((masterRes.data.values ?? []) as string[][]);
  const pending: LiveSheetPipelineRow[] = [];
  const seenPending = new Set<string>();

  for (const row of (finalRes.data.values ?? []) as string[][]) {
    const rsvp = cell(row, 0).toLowerCase();
    if (!rsvp.startsWith('yes')) continue;
    const company = cell(row, 3);
    if (!company || isHeaderOrTotal(company, cell(row, 0))) continue;
    const key = normalizeCompanyKey(company);
    if (seenPending.has(key)) continue;
    seenPending.add(key);

    const overlay = findMasterOverlay(company, master);
    const booths = overlay?.booths || parseBoothCount(cell(row, 4));
    const spend = overlay?.spend || parseMoneyToCents(cell(row, 6));
    const rate = booths > 0 ? Math.round(spend / booths) : spend > 0 ? spend : 1_500_000;
    const brands = overlay?.brands || cell(row, 5);
    const initials = overlay?.initials || cell(row, 2) || 'SS';
    const sheetNotes = overlay?.notes || cell(row, 11) || '';

    pending.push({
      section: 'pending_renewal',
      company_name: company,
      rep_initials: initials,
      brands_text: brands,
      booth_count: booths,
      rate_per_booth_cents: rate,
      total_spend_cents: spend || (booths > 0 ? booths * rate : 0),
      sheet_notes: sheetNotes,
      rsvp: overlay?.rsvp || cell(row, 0),
    });
  }

  // Also include 2026 Master "pending" RSVP companies not already in 2025 Yes list
  for (const [key, overlay] of master) {
    if (seenPending.has(key)) continue;
    const rsvp = overlay.rsvp.toLowerCase();
    if (!(rsvp === 'pending' || rsvp.startsWith('pending'))) continue;
    // recover company name from master raw rows
  }

  for (const row of (masterRes.data.values ?? []) as string[][]) {
    const rsvp = cell(row, 0).toLowerCase();
    if (!(rsvp === 'pending' || rsvp.startsWith('pending'))) continue;
    const company = cell(row, 3);
    if (!company || isHeaderOrTotal(company, cell(row, 0))) continue;
    const key = normalizeCompanyKey(company);
    if (seenPending.has(key)) continue;
    seenPending.add(key);
    const booths = parseBoothCount(cell(row, 4));
    const spend = parseMoneyToCents(cell(row, 6));
    const rate = booths > 0 ? Math.round(spend / booths) : 1_500_000;
    pending.push({
      section: 'pending_renewal',
      company_name: company,
      rep_initials: cell(row, 2) || 'SS',
      brands_text: cell(row, 5),
      booth_count: booths,
      rate_per_booth_cents: rate,
      total_spend_cents: spend || (booths > 0 ? booths * rate : 0),
      sheet_notes: [cell(row, 11), cell(row, 8)].filter(Boolean).join(' — '),
      rsvp: cell(row, 0),
    });
  }

  const newBusiness: LiveSheetPipelineRow[] = [];
  const seenNew = new Set<string>();
  let inNewBiz = false;
  for (const row of (marvinRes.data.values ?? []) as string[][]) {
    const a = cell(row, 0);
    const aUp = a.toUpperCase();
    if (aUp.includes('NEW BUSINESS')) {
      inNewBiz = true;
      continue;
    }
    if (!inNewBiz) continue;
    if (aUp === 'TOTAL' || aUp.startsWith('TOTAL ') || aUp.includes('CONFIRMED + PENDING')) break;
    if (aUp === 'SALES REP') continue;
    const company = cell(row, 1);
    if (!company || isHeaderOrTotal(company, a)) continue;
    const key = normalizeCompanyKey(company);
    if (seenNew.has(key)) continue;
    seenNew.add(key);
    const brandsOrNotes = cell(row, 2);
    const booths = parseBoothCount(cell(row, 3));
    const rate = parseMoneyToCents(cell(row, 4));
    const spend = parseMoneyToCents(cell(row, 6));
    newBusiness.push({
      section: 'new_business',
      company_name: company,
      rep_initials: a || '—',
      brands_text: brandsOrNotes,
      booth_count: booths,
      rate_per_booth_cents: rate,
      total_spend_cents: spend,
      sheet_notes: brandsOrNotes,
      rsvp: '',
    });
  }

  return {
    pending,
    newBusiness,
    fetchedAt: new Date().toISOString(),
    sources: { pendingSheetId, marvinSheetId },
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
