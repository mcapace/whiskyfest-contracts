import { getSheetsClient } from '@/lib/sheets-tracker';
import { rosterStatusLabel } from '@/lib/exhibitor-roster';
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

export async function writeExhibitorRosterStatusForContract(
  contract: Pick<
    ContractWithTotals,
    'id' | 'status' | 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number' | 'updated_at'
  >,
  options?: { trackerStatus?: ContractStatus },
): Promise<void> {
  const spreadsheetId = contract.source_sheet_id?.trim();
  const tab = contract.source_sheet_tab?.trim();
  const rowNumber = contract.source_row_number;
  if (!spreadsheetId || !tab || !rowNumber || rowNumber < 2) return;

  const status = options?.trackerStatus ?? contract.status;
  const sheets = getSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(tab, 'A1:AZ1'),
  });
  const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
  const licenseIdx = headers.findIndex((h) => h.toUpperCase() === ROSTER_STATUS_HEADER);
  const statusStart = licenseIdx >= 0 ? licenseIdx : headers.length;

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
      values: [[rosterStatusLabel(status), contract.id, updatedLabel]],
    },
  });
}
