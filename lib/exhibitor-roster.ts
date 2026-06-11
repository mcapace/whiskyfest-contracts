import { getSupabaseAdmin } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/sheets-tracker';
import { formatStatus } from '@/lib/status-display';
import type { ContractStatus, ContractWithTotals, Event } from '@/types/db';

export const ROSTER_STATUS_HEADER = 'LICENSE STATUS';
export const ROSTER_CONTRACT_ID_HEADER = 'CONTRACT ID';
export const ROSTER_LAST_UPDATED_HEADER = 'LAST UPDATED';

export type ExhibitorRosterSheetConfig = {
  key: string;
  label: string;
  spreadsheet_id: string;
  tab: string;
};

export type ExhibitorRosterRow = {
  rowKey: string;
  listKey: string;
  listLabel: string;
  spreadsheetId: string;
  tab: string;
  rowNumber: number;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  billingCompany: string;
  billingEmail: string;
  wineName: string;
  vintage: string;
  participation: string;
  contractId: string | null;
  contractStatus: ContractStatus | null;
  sheetStatus: string | null;
  sheetContractId: string | null;
  sheetLastUpdated: string | null;
};

type ColumnMap = {
  wineryName: number;
  participation: number;
  primaryFirst: number;
  primaryLast: number;
  primaryEmail: number;
  wineName: number;
  vintage: number;
  billingFirst: number;
  billingLast: number;
  billingEmail: number;
  billingCompany: number;
  billingStreet: number;
  city: number;
  state: number;
  zip: number;
  contractRepFirst: number;
  contractRepLast: number;
  contractRepEmail: number;
};

const STANDARD_COLUMNS: ColumnMap = {
  wineryName: 2,
  participation: 3,
  primaryFirst: 9,
  primaryLast: 10,
  primaryEmail: 11,
  wineName: 16,
  vintage: 17,
  billingFirst: 21,
  billingLast: 22,
  billingEmail: 23,
  billingCompany: 24,
  billingStreet: 25,
  city: 26,
  state: 27,
  zip: 29,
  contractRepFirst: 30,
  contractRepLast: 31,
  contractRepEmail: 33,
};

const NEW_COLUMNS: ColumnMap = {
  wineryName: 2,
  participation: 3,
  primaryFirst: 9,
  primaryLast: 10,
  primaryEmail: 11,
  wineName: 15,
  vintage: 16,
  billingFirst: 20,
  billingLast: 21,
  billingEmail: 22,
  billingCompany: 23,
  billingStreet: 24,
  city: 25,
  state: 26,
  zip: 28,
  contractRepFirst: 29,
  contractRepLast: 30,
  contractRepEmail: 32,
};

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function cell(row: string[], index: number): string {
  const v = row[index];
  return v != null ? String(v).trim() : '';
}

function columnMapForList(listKey: string): ColumnMap {
  return listKey === 'new' ? NEW_COLUMNS : STANDARD_COLUMNS;
}

function participationYes(row: string[], map: ColumnMap): boolean {
  return cell(row, map.participation).toLowerCase().includes('yes');
}

export function rosterRowKey(spreadsheetId: string, tab: string, rowNumber: number): string {
  return `${spreadsheetId}|${tab}|${rowNumber}`;
}

export function parseRosterRowKey(rowKey: string): { spreadsheetId: string; tab: string; rowNumber: number } | null {
  const parts = rowKey.split('|');
  if (parts.length < 3) return null;
  const rowNumber = Number(parts[parts.length - 1]);
  const tab = parts[parts.length - 2];
  const spreadsheetId = parts.slice(0, -2).join('|');
  if (!spreadsheetId || !tab || !Number.isFinite(rowNumber) || rowNumber < 2) return null;
  return { spreadsheetId, tab, rowNumber };
}

export function rosterStatusLabel(status: ContractStatus | null): string {
  if (!status) return 'Not started';
  return formatStatus(status);
}

export function rosterSheetsFromEvent(event: Event): ExhibitorRosterSheetConfig[] {
  const raw = event.exhibitor_roster_sheets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Partial<ExhibitorRosterSheetConfig>;
      if (!row.spreadsheet_id?.trim() || !row.tab?.trim()) return null;
      return {
        key: row.key?.trim() || row.spreadsheet_id,
        label: row.label?.trim() || row.key || 'Exhibitors',
        spreadsheet_id: row.spreadsheet_id.trim(),
        tab: row.tab.trim(),
      };
    })
    .filter(Boolean) as ExhibitorRosterSheetConfig[];
}

function resolveSigner(row: string[], map: ColumnMap): { name: string; email: string } {
  const repEmail = cell(row, map.contractRepEmail);
  const repFirst = cell(row, map.contractRepFirst);
  const repLast = cell(row, map.contractRepLast);
  if (repEmail) {
    return { name: [repFirst, repLast].filter(Boolean).join(' ').trim() || repEmail, email: repEmail };
  }
  const billingEmail = cell(row, map.billingEmail);
  const billingFirst = cell(row, map.billingFirst);
  const billingLast = cell(row, map.billingLast);
  if (billingEmail) {
    return {
      name: [billingFirst, billingLast].filter(Boolean).join(' ').trim() || billingEmail,
      email: billingEmail,
    };
  }
  const primaryEmail = cell(row, map.primaryEmail);
  const primaryFirst = cell(row, map.primaryFirst);
  const primaryLast = cell(row, map.primaryLast);
  return {
    name: [primaryFirst, primaryLast].filter(Boolean).join(' ').trim() || primaryEmail,
    email: primaryEmail,
  };
}

export function buildContractPayloadFromRosterRow(
  row: string[],
  listKey: string,
  event: Event,
): {
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  signer_1_name: string;
  signer_1_email: string;
  brands_poured: string | null;
  booth_count: number;
  booth_rate_cents: number;
} {
  const map = columnMapForList(listKey);
  const winery = cell(row, map.wineryName);
  const billingCompany = cell(row, map.billingCompany) || winery;
  const signer = resolveSigner(row, map);
  const wineName = cell(row, map.wineName);
  const vintage = cell(row, map.vintage);
  const brandLine = [wineName, vintage].filter(Boolean).join(' ').trim();

  return {
    exhibitor_legal_name: billingCompany,
    exhibitor_company_name: winery || billingCompany,
    signer_1_name: signer.name,
    signer_1_email: signer.email,
    brands_poured: brandLine || null,
    booth_count: 1,
    booth_rate_cents: event.booth_rate_cents,
  };
}

async function readSheetRows(config: ExhibitorRosterSheetConfig): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheet_id,
    range: tabRange(config.tab, 'A2:AZ1000'),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values ?? []) as string[][];
}

function statusColumnStart(headers: string[]): number {
  const licenseIdx = headers.findIndex((h) => String(h).trim().toUpperCase() === ROSTER_STATUS_HEADER);
  if (licenseIdx >= 0) return licenseIdx;
  return headers.length;
}

export async function fetchExhibitorRoster(event: Event): Promise<{
  syncedAt: string;
  sheets: ExhibitorRosterSheetConfig[];
  rows: ExhibitorRosterRow[];
}> {
  const sheetConfigs = rosterSheetsFromEvent(event);
  const supabase = getSupabaseAdmin();
  const { data: linkedContracts } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', event.id)
    .not('source_sheet_id', 'is', null);

  const contractByRowKey = new Map<string, ContractWithTotals>();
  for (const contract of (linkedContracts ?? []) as ContractWithTotals[]) {
    if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) continue;
    contractByRowKey.set(
      rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number),
      contract,
    );
  }

  const sheets = getSheetsClient();
  const rows: ExhibitorRosterRow[] = [];

  for (const config of sheetConfigs) {
    const [headerRes, dataRows] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheet_id,
        range: tabRange(config.tab, 'A1:AZ1'),
      }),
      readSheetRows(config),
    ]);
    const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
    const statusStart = statusColumnStart(headers);
    const map = columnMapForList(config.key);

    dataRows.forEach((row, index) => {
      if (!participationYes(row, map)) return;
      const rowNumber = index + 2;
      const rowKey = rosterRowKey(config.spreadsheet_id, config.tab, rowNumber);
      const contract = contractByRowKey.get(rowKey) ?? null;
      const signer = resolveSigner(row, map);
      rows.push({
        rowKey,
        listKey: config.key,
        listLabel: config.label,
        spreadsheetId: config.spreadsheet_id,
        tab: config.tab,
        rowNumber,
        wineryName: cell(row, map.wineryName),
        signerName: signer.name,
        signerEmail: signer.email,
        billingCompany: cell(row, map.billingCompany),
        billingEmail: cell(row, map.billingEmail),
        wineName: cell(row, map.wineName),
        vintage: cell(row, map.vintage),
        participation: cell(row, map.participation),
        contractId: contract?.id ?? null,
        contractStatus: contract?.status ?? null,
        sheetStatus: cell(row, statusStart) || null,
        sheetContractId: cell(row, statusStart + 1) || null,
        sheetLastUpdated: cell(row, statusStart + 2) || null,
      });
    });
  }

  rows.sort((a, b) => a.wineryName.localeCompare(b.wineryName, undefined, { sensitivity: 'base' }));

  return { syncedAt: new Date().toISOString(), sheets: sheetConfigs, rows };
}
