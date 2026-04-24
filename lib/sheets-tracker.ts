import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { ContractWithTotals } from '@/types/db';

/** Same service account JSON as Drive/Docs; spreadsheets scope added below. */
function getSheetsAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');

  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function getSheetsClient() {
  const auth = getSheetsAuth();
  return google.sheets({ version: 'v4', auth });
}

function getTrackerConfig(): { spreadsheetId: string; tab: string } | null {
  const spreadsheetId = process.env['SHEETS_TRACKER_ID']?.trim();
  if (!spreadsheetId) return null;
  /** Must match the tab name in the spreadsheet exactly (case-sensitive); default only if your sheet still uses "Sheet1". */
  const tab = process.env['SHEETS_TRACKER_TAB']?.trim() || 'Sheet1';
  return { spreadsheetId, tab };
}

/** Log Google Sheets client errors (Gaxios includes `response.data` with API message, e.g. invalid tab/range). */
function logSheetsApiError(context: string, err: unknown, extra?: Record<string, unknown>) {
  const g = err as {
    message?: string;
    response?: { status?: number; statusText?: string; data?: unknown };
  };
  let responseBody: string | undefined;
  try {
    const d = g.response?.data;
    if (d === undefined) responseBody = undefined;
    else if (typeof d === 'string') responseBody = d;
    else responseBody = JSON.stringify(d);
  } catch {
    responseBody = String(g.response?.data);
  }
  console.error('[sheets-tracker]', context, {
    ...extra,
    message: g?.message,
    httpStatus: g?.response?.status,
    httpStatusText: g?.response?.statusText,
    responseBody,
  });
}

/** Escape sheet tab name for A1 notation when needed. */
function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

/** Total revenue in cents → "$15,000". */
export function formatBoothAmount(amountCents: number): string {
  return formatCurrency(amountCents, { showCents: false });
}

export function formatBrandsList(brands: string[]): string {
  if (!brands.length) return '';
  return brands.map((b, i) => `${i + 1}) ${b.trim()}`).join('   ');
}

/** Split free-text brands field into a list for the sheet. */
export function parseBrandsFromContract(brandsPoured: string | null): string[] {
  if (!brandsPoured?.trim()) return [];
  return brandsPoured
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Maps lifecycle states to the Status/Notes column (US date M/D, no leading zeros).
 * Pass `voided` / `declined` when the DB uses `error` but DocuSign indicates void/decline.
 */
export function formatStatusNote(status: string, date: Date): string {
  const md = `${date.getMonth() + 1}/${date.getDate()}`;
  switch (status) {
    case 'partially_signed':
      return `Exhibitor signed ${md}`;
    case 'signed':
      return `Fully signed ${md}`;
    case 'executed':
      return `Executed ${md}`;
    case 'cancelled':
      return `Cancelled ${md}`;
    case 'voided':
      return `Voided ${md}`;
    case 'declined':
      return `Declined ${md}`;
    default:
      return `${status} ${md}`;
  }
}

function resolveStatusKeyForNote(
  contract: ContractWithTotals,
  trackerStatus?: 'voided' | 'declined',
): string {
  if (trackerStatus) return trackerStatus;
  return contract.status;
}

function rsvpColumn(contract: ContractWithTotals, trackerStatus?: 'voided' | 'declined'): string {
  const key = trackerStatus ?? contract.status;
  if (key === 'voided' || key === 'declined') return 'No';
  if (contract.status === 'cancelled') return 'No';
  if (key === 'signed' || key === 'executed') return 'Yes';
  if (key === 'partially_signed') return 'Pending';
  return 'Pending';
}

export async function getSalesRepName(contract: ContractWithTotals): Promise<string> {
  const fromView = contract.sales_rep_name?.trim();
  if (fromView) return fromView;

  if (!contract.sales_rep_id) return '—';

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('sales_reps').select('name').eq('id', contract.sales_rep_id).maybeSingle();

  return data?.name?.trim() || '—';
}

async function buildRowValues(
  contract: ContractWithTotals,
  at: Date,
  trackerStatus?: 'voided' | 'declined',
): Promise<(string | number | boolean)[]> {
  const rep = await getSalesRepName(contract);
  const brands = formatBrandsList(parseBrandsFromContract(contract.brands_poured));
  const rev = formatBoothAmount(contract.total_amount_cents);
  const statusKey = resolveStatusKeyForNote(contract, trackerStatus);
  const note = formatStatusNote(statusKey, at);

  const row: (string | number | boolean)[] = [
    rsvpColumn(contract, trackerStatus),
    rep,
    contract.exhibitor_company_name,
    contract.booth_count,
    brands,
    rev,
    '',
    true,
    contract.signer_1_name ?? '',
    contract.signer_1_email ?? '',
    note,
    '',
    '',
    contract.id,
  ];

  return row;
}

export async function findRowByContractId(contractId: string): Promise<number | null> {
  const cfg = getTrackerConfig();
  if (!cfg) return null;

  try {
    const sheets = getSheetsClient();
    const range = tabRange(cfg.tab, 'N4:N');

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = res.data.values;
    if (!rows?.length) return null;

    const target = contractId.trim();
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i]?.[0];
      const val = cell != null ? String(cell).trim() : '';
      if (val === target) return i + 4;
    }

    return null;
  } catch (err) {
    logSheetsApiError('findRowByContractId', err, {
      contractId,
      tab: cfg.tab,
      spreadsheetId: cfg.spreadsheetId,
    });
    throw err;
  }
}

/**
 * Inserts a new row at row 4 (existing data shifts down). Idempotent: if contract id
 * already appears in column N, updates that row instead.
 */
export async function appendContractRow(contract: ContractWithTotals): Promise<void> {
  console.log('[sheets-tracker] appendContractRow called', { contractId: contract.id });

  const cfg = getTrackerConfig();
  if (!cfg) {
    console.warn('[sheets-tracker] appendContractRow skipped: SHEETS_TRACKER_ID not set', {
      contractId: contract.id,
    });
    return;
  }

  console.log('[sheets-tracker] appendContractRow config', {
    contractId: contract.id,
    spreadsheetId: cfg.spreadsheetId,
    tab: cfg.tab,
    range: tabRange(cfg.tab, 'A4:N'),
  });

  try {
    const existing = await findRowByContractId(contract.id);
    if (existing != null) {
      console.log('[sheets-tracker] appendContractRow row already exists; updating instead', {
        contractId: contract.id,
        rowNum: existing,
      });
      await updateContractRow(contract);
      return;
    }

    const sheets = getSheetsClient();
    const at = new Date();
    const row = await buildRowValues(contract, at);

    await sheets.spreadsheets.values.append({
      spreadsheetId: cfg.spreadsheetId,
      range: tabRange(cfg.tab, 'A4:N'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    console.log('[sheets-tracker] appendContractRow Google Sheets append succeeded', {
      contractId: contract.id,
      tab: cfg.tab,
    });
  } catch (err) {
    logSheetsApiError('appendContractRow failed', err, { contractId: contract.id, tab: cfg.tab });
    throw err;
  }
}

export async function updateContractRow(
  contract: ContractWithTotals,
  options?: { trackerStatus?: 'voided' | 'declined' },
): Promise<void> {
  console.log('[sheets-tracker] updateContractRow called', {
    contractId: contract.id,
    trackerStatus: options?.trackerStatus,
  });

  const cfg = getTrackerConfig();
  if (!cfg) {
    console.warn('[sheets-tracker] updateContractRow skipped: SHEETS_TRACKER_ID not set', {
      contractId: contract.id,
    });
    return;
  }

  try {
    const rowNum = await findRowByContractId(contract.id);
    const at = new Date();

    if (rowNum == null) {
      console.warn('[sheets-tracker] Contract not in sheet yet, appending instead', { contractId: contract.id });
      const row = await buildRowValues(contract, at, options?.trackerStatus);
      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: cfg.spreadsheetId,
        range: tabRange(cfg.tab, 'A4:N'),
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
      console.log('[sheets-tracker] updateContractRow append fallback succeeded', { contractId: contract.id });
      return;
    }

    const sheets = getSheetsClient();
    const row = await buildRowValues(contract, at, options?.trackerStatus);

    await sheets.spreadsheets.values.update({
      spreadsheetId: cfg.spreadsheetId,
      range: tabRange(cfg.tab, `A${rowNum}:N${rowNum}`),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    console.log('[sheets-tracker] updateContractRow Google Sheets update succeeded', {
      contractId: contract.id,
      rowNum,
    });
  } catch (err) {
    logSheetsApiError('updateContractRow failed', err, { contractId: contract.id, tab: cfg.tab });
    throw err;
  }
}
