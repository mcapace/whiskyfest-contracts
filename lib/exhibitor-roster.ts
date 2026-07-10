import { getSupabaseAdmin } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/sheets-tracker';
import { formatRosterWineDisplay } from '@/lib/exhibitor-roster-columns';
import {
  billingFieldsFromRosterRow,
  resolveContractStreetFromSheetCells,
  rosterRowHasContractAddress,
  ROSTER_MISSING_ADDRESS_MESSAGE,
} from '@/lib/exhibitor-roster-billing';
import type { NyweBillingFields } from '@/lib/nywe-billing';
import { nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import {
  hasWithdrawnRosterParticipation,
  isActiveRosterParticipation,
  isRosterParticipationPending,
} from '@/lib/exhibitor-roster-participation';
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

export type ExhibitorRosterSheetField = {
  label: string;
  value: string;
};

export type ExhibitorRosterRow = {
  rowKey: string;
  listKey: string;
  listLabel: string;
  spreadsheetId: string;
  tab: string;
  rowNumber: number;
  wineryName: string;
  wineryAddress: string;
  signerName: string;
  signerEmail: string;
  billingCompany: string;
  billingContactName: string;
  billingEmail: string;
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryPhone: string;
  importerName: string;
  importerEmail: string;
  wineName: string;
  vintage: string;
  participation: string;
  contractId: string | null;
  contractStatus: ContractStatus | null;
  /** From linked license — used for approve/send review cards. */
  contractGrandTotalCents: number | null;
  contractBillingLine1: string | null;
  contractBillingCity: string | null;
  contractBillingState: string | null;
  contractBillingZip: string | null;
  contractSignerCcName: string | null;
  contractSignerCcEmail: string | null;
  /** Contract was recalled from DocuSign and returned to draft. */
  recalledToDraft: boolean;
  sheetStatus: string | null;
  sheetContractId: string | null;
  sheetLastUpdated: string | null;
  /** Non-empty cells from the Google Sheet row, keyed by header label. */
  sheetFields: ExhibitorRosterSheetField[];
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
  billingCity: number;
  billingState: number;
  billingCountry: number;
  billingZip: number;
  wineryStreet: number;
  contractRepFirst: number;
  contractRepLast: number;
  contractRepEmail: number;
  primaryPhone: number;
  importerName: number;
  importerPhone: number;
  importerEmail: number;
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
  billingCity: 26,
  billingState: 27,
  billingCountry: 28,
  billingZip: 29,
  wineryStreet: 6,
  contractRepFirst: 30,
  contractRepLast: 31,
  contractRepEmail: 33,
  primaryPhone: 12,
  importerName: 18,
  importerPhone: 19,
  importerEmail: 20,
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
  billingCity: 25,
  billingState: 26,
  billingCountry: 27,
  billingZip: 28,
  wineryStreet: 6,
  contractRepFirst: 29,
  contractRepLast: 30,
  contractRepEmail: 32,
  primaryPhone: 12,
  importerName: 17,
  importerPhone: 18,
  importerEmail: 19,
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

function normalizeHeaderLabel(label: string): string {
  return String(label ?? '').trim().toUpperCase();
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const norm = headers.map(normalizeHeaderLabel);
  for (const candidate of candidates) {
    const key = normalizeHeaderLabel(candidate);
    const exact = norm.indexOf(key);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const key = normalizeHeaderLabel(candidate);
    const fuzzy = norm.findIndex((h) => h.includes(key) || key.includes(h));
    if (fuzzy >= 0) return fuzzy;
  }
  return -1;
}

/** Prefer columns that appear after a known anchor (e.g. billing city after billing street). */
function headerIndexAfter(headers: string[], afterIndex: number, ...candidates: string[]): number {
  if (afterIndex < 0) return -1;
  const norm = headers.map(normalizeHeaderLabel);
  for (let i = afterIndex + 1; i < norm.length; i++) {
    for (const candidate of candidates) {
      const key = normalizeHeaderLabel(candidate);
      if (norm[i] === key || norm[i].includes(key) || key.includes(norm[i])) return i;
    }
  }
  return -1;
}

/** Resolve column indices from the sheet header row (falls back to list-specific defaults). */
export function buildColumnMapFromHeaders(headers: string[], listKey: string): ColumnMap {
  const fallback = columnMapForList(listKey);
  const pick = (key: keyof ColumnMap, ...names: string[]) => {
    const index = headerIndex(headers, ...names);
    return index >= 0 ? index : fallback[key];
  };
  return {
    wineryName: pick('wineryName', 'NAME OF PARTICIPATING WINERY'),
    participation: (() => {
      const index = headerIndex(
        headers,
        'PLEASE CONFIRM YOUR PARTICIPATION:',
        'PLEASE CONFIRM YOUR PARTICIPATION',
        'PARTICIPATION',
      );
      return index >= 0 ? index : -1;
    })(),
    primaryFirst: pick('primaryFirst', 'PRIMARY CONTACT FIRST NAME'),
    primaryLast: pick('primaryLast', 'PRIMARY CONTACT LAST NAME'),
    primaryEmail: pick('primaryEmail', 'PRIMARY CONTACT EMAIL'),
    primaryPhone: pick('primaryPhone', 'PRIMARY CONTACT PHONE (must be a US cell#)', 'PRIMARY CONTACT PHONE'),
    wineName: pick('wineName', 'WINE NAME', 'WINE NAME '),
    vintage: pick('vintage', 'VINTAGE', 'VINTAGE '),
    billingFirst: pick('billingFirst', 'BILLING CONTACT FIRST NAME'),
    billingLast: pick('billingLast', 'BILLING CONTACT LAST NAME'),
    billingEmail: pick('billingEmail', 'BILLING CONTACT EMAIL'),
    billingCompany: pick('billingCompany', 'BILLING COMPANY NAME'),
    billingStreet: pick('billingStreet', 'BILLING STREET ADDRESS/ P.O BOX #', 'BILLING STREET ADDRESS'),
    wineryStreet: pick('wineryStreet', 'STREET ADDRESS OF WINERY *', 'STREET ADDRESS OF WINERY'),
    billingCity: (() => {
      const street = pick('billingStreet', 'BILLING STREET ADDRESS/ P.O BOX #', 'BILLING STREET ADDRESS');
      const afterStreet = headerIndexAfter(headers, street, 'CITY');
      return afterStreet >= 0 ? afterStreet : pick('billingCity', 'CITY');
    })(),
    billingState: (() => {
      const street = pick('billingStreet', 'BILLING STREET ADDRESS/ P.O BOX #', 'BILLING STREET ADDRESS');
      const afterStreet = headerIndexAfter(headers, street, 'STATE');
      return afterStreet >= 0 ? afterStreet : pick('billingState', 'STATE');
    })(),
    billingCountry: (() => {
      const street = pick('billingStreet', 'BILLING STREET ADDRESS/ P.O BOX #', 'BILLING STREET ADDRESS');
      const afterStreet = headerIndexAfter(
        headers,
        street,
        'COUNTRY (IF APPLICABLE)',
        'COUNTRY',
      );
      return afterStreet >= 0 ? afterStreet : pick('billingCountry', 'COUNTRY (IF APPLICABLE)', 'COUNTRY');
    })(),
    billingZip: (() => {
      const street = pick('billingStreet', 'BILLING STREET ADDRESS/ P.O BOX #', 'BILLING STREET ADDRESS');
      const afterStreet = headerIndexAfter(headers, street, 'ZIP CODE/POSTAL CODE', 'ZIP CODE', 'ZIP');
      return afterStreet >= 0 ? afterStreet : pick('billingZip', 'ZIP CODE/POSTAL CODE', 'ZIP CODE', 'ZIP');
    })(),
    contractRepFirst: pick('contractRepFirst', 'CONTRACT REPRESENTATIVE FIRST NAME'),
    contractRepLast: pick('contractRepLast', 'CONTRACT REPRESENTATIVE LAST NAME'),
    contractRepEmail: pick('contractRepEmail', 'CONTRACT REPRESENTATIVE EMAIL ADDRESS'),
    importerName: pick('importerName', 'IMPORTER CONTACT NAME', 'IMPORTER CONTACT NAME '),
    importerPhone: pick('importerPhone', 'IMPORTER CONTACT PHONE NUMBER', 'IMPORTER CONTACT PHONE NUMBER '),
    importerEmail: pick('importerEmail', 'IMPORTER EMAIL ADDRESS', 'IMPORTER EMAIL ADDRESS '),
  };
}

function rowIncludedInRoster(row: string[], map: ColumnMap): boolean {
  const winery = cell(row, map.wineryName);
  if (!winery) return false;
  if (map.participation < 0) return true;
  const part = cell(row, map.participation);
  if (isRosterParticipationPending(part)) return true;
  if (hasWithdrawnRosterParticipation(part)) return false;
  return isActiveRosterParticipation(part);
}

export {
  hasWithdrawnRosterParticipation,
  isActiveRosterParticipation,
  isRosterParticipationPending,
} from '@/lib/exhibitor-roster-participation';

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

export function rosterStatusLabel(status: ContractStatus | null, options?: { recalled?: boolean }): string {
  if (options?.recalled) return 'Recalled';
  if (!status) return 'Not started';
  return formatStatus(status);
}

export async function recalledContractIds(eventId: string, contractIds: string[]): Promise<Set<string>> {
  if (contractIds.length === 0) return new Set();

  const supabase = getSupabaseAdmin();
  const { data: recalls } = await supabase
    .from('audit_log')
    .select('contract_id')
    .eq('action', 'contract_recalled_to_draft')
    .in('contract_id', contractIds);

  return new Set((recalls ?? []).map((row) => row.contract_id as string));
}

/** Merge live contract status onto cached roster rows (Sheets data can be cached; license status cannot). */
export async function hydrateRosterRowsWithContracts(
  eventId: string,
  rows: ExhibitorRosterRow[],
): Promise<ExhibitorRosterRow[]> {
  if (rows.length === 0) return rows;

  const supabase = getSupabaseAdmin();
  const { data: linkedContracts } = await supabase
    .from('contracts_with_totals')
    .select(
      'id, status, updated_at, grand_total_cents, billing_address_line1, billing_city, billing_state, billing_zip, signer_cc_name, signer_cc_email, source_sheet_id, source_sheet_tab, source_row_number',
    )
    .eq('event_id', eventId)
    .not('source_sheet_id', 'is', null);

  const contractByRowKey = new Map<string, ContractWithTotals>();
  for (const contract of (linkedContracts ?? []) as ContractWithTotals[]) {
    if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) continue;
    contractByRowKey.set(
      rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number),
      contract,
    );
  }

  const recalledIds = await recalledContractIds(
    eventId,
    [...contractByRowKey.values()].filter((c) => c.status === 'draft' && !c.sent_at).map((c) => c.id),
  );

  return rows.map((row) => {
    const contract = contractByRowKey.get(row.rowKey) ?? null;
    if (!contract) {
      return {
        ...row,
        contractId: null,
        contractStatus: null,
        contractGrandTotalCents: null,
        contractBillingLine1: null,
        contractBillingCity: null,
        contractBillingState: null,
        contractBillingZip: null,
        contractSignerCcName: null,
        contractSignerCcEmail: null,
        recalledToDraft: false,
        sheetStatus: null,
        sheetContractId: null,
      };
    }

    const recalledToDraft = recalledIds.has(contract.id);
    const statusLabel = rosterStatusLabel(contract.status, { recalled: recalledToDraft });

    return {
      ...row,
      contractId: contract.id,
      contractStatus: contract.status,
      contractGrandTotalCents: contract.grand_total_cents ?? null,
      contractBillingLine1: contract.billing_address_line1 ?? null,
      contractBillingCity: contract.billing_city ?? null,
      contractBillingState: contract.billing_state ?? null,
      contractBillingZip: contract.billing_zip ?? null,
      contractSignerCcName: contract.signer_cc_name ?? null,
      contractSignerCcEmail: contract.signer_cc_email ?? null,
      recalledToDraft,
      sheetStatus: statusLabel,
      sheetContractId: contract.id,
      sheetLastUpdated: contract.updated_at ?? row.sheetLastUpdated,
    };
  });
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

function buildSheetFields(headers: string[], row: string[]): ExhibitorRosterSheetField[] {
  const fields: ExhibitorRosterSheetField[] = [];
  const max = Math.max(headers.length, row.length);
  for (let i = 0; i < max; i++) {
    const label = String(headers[i] ?? '').trim();
    const value = cell(row, i);
    if (!label || !value) continue;
    fields.push({ label, value });
  }
  return fields;
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
  headers?: string[],
): {
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  signer_1_name: string;
  signer_1_email: string;
  brands_poured: string | null;
  booth_count: number;
  booth_rate_cents: number;
  billing: NyweBillingFields | null;
  event_contact_name: string | null;
  event_contact_email: string | null;
} {
  const map = headers?.length ? buildColumnMapFromHeaders(headers, listKey) : columnMapForList(listKey);
  const winery = cell(row, map.wineryName);
  const billingCompany = cell(row, map.billingCompany) || winery;
  const signer = resolveSigner(row, map);
  const wineName = cell(row, map.wineName);
  const vintage = cell(row, map.vintage);
  const brandLine = formatRosterWineDisplay(wineName, vintage);
  const primaryFirst = cell(row, map.primaryFirst);
  const primaryLast = cell(row, map.primaryLast);
  const primaryEmail = cell(row, map.primaryEmail);

  return {
    exhibitor_legal_name: billingCompany,
    exhibitor_company_name: winery || billingCompany,
    signer_1_name: signer.name,
    signer_1_email: signer.email,
    brands_poured: brandLine || null,
    booth_count: 1,
    booth_rate_cents: nyweLicenseFeeCents(event),
    billing: billingFieldsFromRosterRow(row, map),
    event_contact_name: [primaryFirst, primaryLast].filter(Boolean).join(' ').trim() || null,
    event_contact_email: primaryEmail || null,
  };
}

/** Build contract fields from a cached roster row — no Google Sheets API calls. */
export function buildContractPayloadFromExhibitorRosterRow(
  row: ExhibitorRosterRow,
  event: Event,
): ReturnType<typeof buildContractPayloadFromRosterRow> {
  const winery = row.wineryName.trim();
  const billingCompany = row.billingCompany.trim() || winery;
  const brandLine = formatRosterWineDisplay(row.wineName, row.vintage);
  const resolved = resolveContractStreetFromSheetCells(row.billingStreet, row.wineryAddress);
  const billingFields: NyweBillingFields | null = resolved
    ? {
        billing_contact_name: row.billingContactName.trim() || null,
        billing_contact_email: row.billingEmail.trim() || null,
        billing_address_line1: resolved.line1,
        billing_address_line2: null,
        billing_city: row.billingCity.trim() || null,
        billing_state: row.billingState.trim() || null,
        billing_zip: row.billingZip.trim() || null,
        billing_country: row.billingCountry.trim() || null,
        billing_same_as_corporate: resolved.usedWineryStreet,
      }
    : null;

  return {
    exhibitor_legal_name: billingCompany,
    exhibitor_company_name: winery || billingCompany,
    signer_1_name: row.signerName.trim(),
    signer_1_email: row.signerEmail.trim(),
    brands_poured: brandLine || null,
    booth_count: 1,
    booth_rate_cents: nyweLicenseFeeCents(event),
    billing: billingFields,
    event_contact_name: row.primaryContactName.trim() || null,
    event_contact_email: row.primaryContactEmail.trim() || null,
  };
}

export { rosterRowHasContractAddress, ROSTER_MISSING_ADDRESS_MESSAGE } from '@/lib/exhibitor-roster-billing';

async function readSheetTab(config: ExhibitorRosterSheetConfig): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheet_id,
    range: tabRange(config.tab, 'A1:AZ1000'),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values ?? []) as string[][];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  warnings: string[];
}> {
  const sheetConfigs = rosterSheetsFromEvent(event);
  if (sheetConfigs.length === 0) {
    throw new Error('No exhibitor roster sheets configured for this event.');
  }

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

  const rows: ExhibitorRosterRow[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < sheetConfigs.length; i++) {
    const config = sheetConfigs[i]!;
    if (i > 0) await sleep(400);
    try {
      const allRows = await readSheetTab(config);
      const headers = ((allRows[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
      const dataRows = allRows.slice(1) as string[][];
      const statusStart = statusColumnStart(headers);
      const map = buildColumnMapFromHeaders(headers, config.key);
      let included = 0;

      dataRows.forEach((row, index) => {
        if (!rowIncludedInRoster(row, map)) return;
        included += 1;
        const rowNumber = index + 2;
        const rowKey = rosterRowKey(config.spreadsheet_id, config.tab, rowNumber);
        const contract = contractByRowKey.get(rowKey) ?? null;
        const signer = resolveSigner(row, map);
        const billingFirst = cell(row, map.billingFirst);
        const billingLast = cell(row, map.billingLast);
        const primaryFirst = cell(row, map.primaryFirst);
        const primaryLast = cell(row, map.primaryLast);
        rows.push({
          rowKey,
          listKey: config.key,
          listLabel: config.label,
          spreadsheetId: config.spreadsheet_id,
          tab: config.tab,
          rowNumber,
          wineryName: cell(row, map.wineryName),
          wineryAddress: cell(row, map.wineryStreet),
          signerName: signer.name,
          signerEmail: signer.email,
          billingCompany: cell(row, map.billingCompany),
          billingContactName: [billingFirst, billingLast].filter(Boolean).join(' ').trim(),
          billingEmail: cell(row, map.billingEmail),
          billingStreet: cell(row, map.billingStreet),
          billingCity: cell(row, map.billingCity),
          billingState: cell(row, map.billingState),
          billingZip: cell(row, map.billingZip),
          billingCountry: cell(row, map.billingCountry),
          primaryContactName: [primaryFirst, primaryLast].filter(Boolean).join(' ').trim(),
          primaryContactEmail: cell(row, map.primaryEmail),
          primaryPhone: cell(row, map.primaryPhone),
          importerName: cell(row, map.importerName),
          importerEmail: cell(row, map.importerEmail),
          wineName: cell(row, map.wineName),
          vintage: cell(row, map.vintage),
          participation: map.participation >= 0 ? cell(row, map.participation) : '',
          contractId: contract?.id ?? null,
          contractStatus: contract?.status ?? null,
          contractGrandTotalCents: contract?.grand_total_cents ?? null,
          contractBillingLine1: contract?.billing_address_line1 ?? null,
          contractBillingCity: contract?.billing_city ?? null,
          contractBillingState: contract?.billing_state ?? null,
          contractBillingZip: contract?.billing_zip ?? null,
          contractSignerCcName: contract?.signer_cc_name ?? null,
          contractSignerCcEmail: contract?.signer_cc_email ?? null,
          recalledToDraft: false,
          sheetStatus: cell(row, statusStart) || null,
          sheetContractId: cell(row, statusStart + 1) || null,
          sheetLastUpdated: cell(row, statusStart + 2) || null,
          sheetFields: buildSheetFields(headers, row),
        });
      });

      if (dataRows.length > 0 && included === 0) {
        warnings.push(
          `${config.label}: ${dataRows.length} rows in Google Sheet but none matched (check winery name and participation columns).`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[fetchExhibitorRoster] ${config.label} failed`, msg);
      warnings.push(`${config.label}: could not load — ${msg}`);
    }
  }

  if (rows.length === 0) {
    throw new Error(
      warnings.length > 0
        ? warnings.join(' · ')
        : 'No exhibitor rows found in configured Google Sheets.',
    );
  }

  rows.sort((a, b) => a.wineryName.localeCompare(b.wineryName, undefined, { sensitivity: 'base' }));

  return { syncedAt: new Date().toISOString(), sheets: sheetConfigs, rows, warnings };
}
