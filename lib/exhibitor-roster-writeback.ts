import { getSheetsClient } from '@/lib/sheets-tracker';
import { rosterStatusLabel } from '@/lib/exhibitor-roster';
import { rosterIdentitiesMatch } from '@/lib/nywe-roster-identity';
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
    const matches =
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
