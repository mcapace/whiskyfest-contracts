import { getSheetsClient } from '@/lib/sheets-tracker';
import { rosterStatusLabel } from '@/lib/exhibitor-roster';
import { rosterIdentitiesMatch, normalizeSheetContractId } from '@/lib/nywe-roster-identity';
import { parseCoveredWineries, type NyweCoveredSourceRow } from '@/lib/nywe-combined-contract';
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

function rosterTargetsForContract(
  contract: Pick<ContractWithTotals, 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number'> &
    Partial<Pick<ContractWithTotals, 'covered_wineries'>>,
): NyweCoveredSourceRow[] {
  const targets: NyweCoveredSourceRow[] = [];
  const push = (source_sheet_id?: string | null, source_sheet_tab?: string | null, source_row_number?: number | null) => {
    if (!source_sheet_id?.trim() || !source_sheet_tab?.trim() || !source_row_number || source_row_number < 2) return;
    const next = {
      source_sheet_id: source_sheet_id.trim(),
      source_sheet_tab: source_sheet_tab.trim(),
      source_row_number,
    };
    if (
      targets.some(
        (row) =>
          row.source_sheet_id === next.source_sheet_id &&
          row.source_sheet_tab === next.source_sheet_tab &&
          row.source_row_number === next.source_row_number,
      )
    ) {
      return;
    }
    targets.push(next);
  };
  push(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number);
  for (const winery of parseCoveredWineries(contract.covered_wineries)) {
    for (const source of winery.source_rows) push(source.source_sheet_id, source.source_sheet_tab, source.source_row_number);
  }
  return targets;
}

function sheetRowMatchesContract(
  contract: Partial<Pick<ContractWithTotals, 'id' | 'exhibitor_company_name' | 'exhibitor_legal_name' | 'covered_wineries'>>,
  sheetWinery: string,
  sheetBilling: string,
  sheetContractId: string | null,
): boolean {
  if (sheetContractId && contract.id && sheetContractId === contract.id.toLowerCase()) return true;
  if (rosterIdentitiesMatch(sheetWinery, contract.exhibitor_company_name)) return true;
  if (rosterIdentitiesMatch(sheetWinery, contract.exhibitor_legal_name)) return true;
  if (rosterIdentitiesMatch(sheetBilling, contract.exhibitor_company_name)) return true;
  if (rosterIdentitiesMatch(sheetBilling, contract.exhibitor_legal_name)) return true;
  return parseCoveredWineries(contract.covered_wineries).some((winery) =>
    rosterIdentitiesMatch(sheetWinery, winery.winery_name),
  );
}

export async function writeExhibitorRosterStatusForContract(
  contract: Pick<
    ContractWithTotals,
    'id' | 'status' | 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number' | 'updated_at'
  > &
    Partial<Pick<ContractWithTotals, 'exhibitor_company_name' | 'exhibitor_legal_name' | 'covered_wineries'>>,
  options?: { trackerStatus?: ContractStatus; statusLabel?: string },
): Promise<void> {
  const targets = rosterTargetsForContract(contract);
  for (const target of targets) {
    await writeExhibitorRosterStatusForSourceRow(contract, target, options);
  }
}

async function writeExhibitorRosterStatusForSourceRow(
  contract: Pick<ContractWithTotals, 'id' | 'status' | 'updated_at'> &
    Partial<Pick<ContractWithTotals, 'exhibitor_company_name' | 'exhibitor_legal_name' | 'covered_wineries'>>,
  source: NyweCoveredSourceRow,
  options?: { trackerStatus?: ContractStatus; statusLabel?: string },
): Promise<void> {
  const spreadsheetId = source.source_sheet_id;
  const tab = source.source_sheet_tab;
  const rowNumber = source.source_row_number;
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
    const matches = sheetRowMatchesContract(contract, sheetWinery, sheetBilling, sheetContractId);
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
