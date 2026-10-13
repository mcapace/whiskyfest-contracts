import { getSheetsClient } from '@/lib/sheets-tracker';
import { rosterStatusLabel } from '@/lib/exhibitor-roster';
import { rosterIdentitiesMatch, normalizeSheetContractId } from '@/lib/nywe-roster-identity';
import { formatTimestamp } from '@/lib/utils';
import type { ContractStatus, ContractWithTotals } from '@/types/db';
import {
  ROSTER_CONTRACT_ID_HEADER,
  ROSTER_LAST_UPDATED_HEADER,
  ROSTER_STATUS_HEADER,
} from '@/lib/exhibitor-roster';

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function colToLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

async function ensureStatusHeaders(
  spreadsheetId: string,
  tab: string,
  statusStart: number,
): Promise<void> {
  const sheets = getSheetsClient();
  const startCol = colToLetter(statusStart);
  const endCol = colToLetter(statusStart + 2);
  const range = tabRange(tab, `${startCol}1:${endCol}1`);
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const row = (existing.data.values?.[0] ?? []) as string[];
  const headers = [ROSTER_STATUS_HEADER, ROSTER_CONTRACT_ID_HEADER, ROSTER_LAST_UPDATED_HEADER];
  const needsWrite = headers.some((h, i) => !String(row[i] ?? '').trim());
  if (!needsWrite) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
}

export const ROSTER_STATUS_HEADERS: [string, string, string] = [
  ROSTER_STATUS_HEADER,
  ROSTER_CONTRACT_ID_HEADER,
  ROSTER_LAST_UPDATED_HEADER,
];

/** True when the three writeback headers are missing or mislabeled at `statusStart`. */
export function rosterStatusHeadersNeedWrite(headers: string[], statusStart: number): boolean {
  return ROSTER_STATUS_HEADERS.some(
    (label, i) => String(headers[statusStart + i] ?? '').trim().toUpperCase() !== label,
  );
}

export type RosterStatusCellWrite = {
  spreadsheetId: string;
  tab: string;
  rowNumber: number;
  statusStart: number;
  /** [LICENSE STATUS, CONTRACT ID, LAST UPDATED] */
  values: [string, string, string];
};

export type RosterStatusHeaderWrite = { spreadsheetId: string; tab: string; statusStart: number };

/** Google caps a single batchUpdate request; keep each call comfortably below it. */
const BATCH_UPDATE_MAX_RANGES = 400;

/**
 * Write status cells for many rows with one `values.batchUpdate` per spreadsheet.
 *
 * The cron used to do three reads and one write per linked contract (hundreds of calls every
 * 30 minutes), which blew the Sheets read quota and timed the function out. Callers diff
 * against the already-fetched roster and pass only the rows that actually changed.
 */
export async function batchWriteExhibitorRosterStatus(
  writes: RosterStatusCellWrite[],
  headerWrites: RosterStatusHeaderWrite[] = [],
): Promise<{ written: number; errors: string[] }> {
  const bySpreadsheet = new Map<string, { range: string; values: string[][] }[]>();
  const push = (spreadsheetId: string, entry: { range: string; values: string[][] }) => {
    const list = bySpreadsheet.get(spreadsheetId) ?? [];
    list.push(entry);
    bySpreadsheet.set(spreadsheetId, list);
  };

  for (const h of headerWrites) {
    const range = tabRange(h.tab, `${colToLetter(h.statusStart)}1:${colToLetter(h.statusStart + 2)}1`);
    push(h.spreadsheetId, { range, values: [[...ROSTER_STATUS_HEADERS]] });
  }
  for (const w of writes) {
    if (w.rowNumber < 2) continue;
    const startCol = colToLetter(w.statusStart);
    const endCol = colToLetter(w.statusStart + 2);
    push(w.spreadsheetId, {
      range: tabRange(w.tab, `${startCol}${w.rowNumber}:${endCol}${w.rowNumber}`),
      values: [[...w.values]],
    });
  }

  if (bySpreadsheet.size === 0) return { written: 0, errors: [] };

  const sheets = getSheetsClient();
  let written = 0;
  const errors: string[] = [];
  for (const [spreadsheetId, data] of bySpreadsheet) {
    for (let i = 0; i < data.length; i += BATCH_UPDATE_MAX_RANGES) {
      const chunk = data.slice(i, i + BATCH_UPDATE_MAX_RANGES);
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: 'USER_ENTERED', data: chunk },
        });
        written += chunk.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[exhibitor-roster] batch writeback failed', { spreadsheetId, ranges: chunk.length, msg });
        errors.push(`${spreadsheetId}: ${msg}`);
      }
    }
  }
  return { written, errors };
}

export async function writeExhibitorRosterStatusForContract(
  contract: Pick<
    ContractWithTotals,
    'id' | 'status' | 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number' | 'updated_at'
  > &
    Partial<Pick<ContractWithTotals, 'exhibitor_company_name' | 'exhibitor_legal_name'>>,
  options?: { trackerStatus?: ContractStatus; statusLabel?: string },
): Promise<void> {
  const spreadsheetId = contract.source_sheet_id?.trim();
  const tab = contract.source_sheet_tab?.trim();
  const rowNumber = contract.source_row_number;
  if (!spreadsheetId || !tab || !rowNumber || rowNumber < 2) return;

  const status = options?.trackerStatus ?? contract.status;
  const label = options?.statusLabel ?? rosterStatusLabel(status);
  const sheets = getSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(tab, 'A1:AZ1'),
  });
  const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
  const licenseIdx = headers.findIndex((h) => h.toUpperCase() === ROSTER_STATUS_HEADER);
  const statusStart = licenseIdx >= 0 ? licenseIdx : headers.length;

  const wineryIdx = headers.findIndex((h) => h.toUpperCase().includes('NAME OF PARTICIPATING WINERY'));
  const billingIdx = headers.findIndex((h) => h.toUpperCase() === 'BILLING COMPANY NAME');
  if (contract.exhibitor_company_name || contract.exhibitor_legal_name) {
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: tabRange(tab, `A${rowNumber}:AZ${rowNumber}`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const row = ((rowRes.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
    const sheetWinery = wineryIdx >= 0 ? row[wineryIdx] : row[2];
    const sheetBilling = billingIdx >= 0 ? row[billingIdx] : '';
    const sheetContractId = normalizeSheetContractId(row[statusStart + 1]);
    const idMatches = sheetContractId === contract.id.toLowerCase();
    const matches =
      idMatches ||
      rosterIdentitiesMatch(sheetWinery, contract.exhibitor_company_name) ||
      rosterIdentitiesMatch(sheetWinery, contract.exhibitor_legal_name) ||
      rosterIdentitiesMatch(sheetBilling, contract.exhibitor_company_name) ||
      rosterIdentitiesMatch(sheetBilling, contract.exhibitor_legal_name);
    if (!matches) {
      console.warn('[nywe-roster] skip writeback — sheet row is a different winery', {
        id: contract.id,
        contractCompany: contract.exhibitor_company_name,
        sheetWinery,
        rowNumber,
      });
      return;
    }
  }

  await ensureStatusHeaders(spreadsheetId, tab, statusStart);

  const startCol = colToLetter(statusStart);
  const endCol = colToLetter(statusStart + 2);
  const range = tabRange(tab, `${startCol}${rowNumber}:${endCol}${rowNumber}`);
  const updatedLabel = formatTimestamp(contract.updated_at ?? new Date().toISOString());

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[label, contract.id, updatedLabel]],
    },
  });
}
