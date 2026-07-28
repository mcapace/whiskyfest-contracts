import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  accountingPortalLabel,
  filterContractsByAccountingPortal,
  parseInvoiceFilter,
  type AccountingPortalKey,
} from '@/lib/accounting-portal';
import { formatInvoiceStatus } from '@/lib/invoice-status';
import { getSheetsClient } from '@/lib/sheets-tracker';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

export type AccountingListSortKey = 'company' | 'event' | 'total' | 'executed' | 'invoice' | 'rep';
export type AccountingListSortDir = 'asc' | 'desc';

export type AccountingListFilters = {
  productKey: AccountingPortalKey;
  invoice?: string;
  q?: string;
  rep?: string;
  eventId?: string;
  sort?: string;
  dir?: string;
  /** Cap for Excel/CSV downloads (Sheets can take more). Default 2000. */
  limit?: number;
};

export type AccountingListExportRow = {
  company: string;
  event: string;
  billingContact: string;
  billingEmail: string;
  total: string;
  totalCents: number;
  salesRep: string;
  executed: string;
  invoiceStatus: string;
};

function parseSortKey(raw: string | undefined): AccountingListSortKey {
  if (raw === 'company' || raw === 'event' || raw === 'total' || raw === 'executed' || raw === 'invoice' || raw === 'rep') {
    return raw;
  }
  return 'executed';
}

function parseSortDir(raw: string | undefined, sort: AccountingListSortKey): AccountingListSortDir {
  if (raw === 'asc' || raw === 'desc') return raw;
  return sort === 'company' || sort === 'event' || sort === 'rep' ? 'asc' : 'desc';
}

function invoiceSortRank(status: InvoiceStatus): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'invoice_sent':
      return 1;
    case 'paid':
      return 2;
    case 'invoice_voided':
      return 3;
    case 'not_invoiced':
      return 4;
    default:
      return 9;
  }
}

function showSalesRep(productKey: AccountingPortalKey): boolean {
  return productKey !== 'wine_spectator';
}

export function accountingListHeaders(productKey: AccountingPortalKey): string[] {
  return [
    'Company',
    'Event',
    'Billing contact',
    'Billing email',
    'Total',
    ...(showSalesRep(productKey) ? ['Sales rep'] : []),
    'Executed',
    'Invoice status',
  ];
}

export function accountingListRowCells(
  row: AccountingListExportRow,
  productKey: AccountingPortalKey,
): string[] {
  return [
    row.company,
    row.event,
    row.billingContact,
    row.billingEmail,
    row.total,
    ...(showSalesRep(productKey) ? [row.salesRep] : []),
    row.executed,
    row.invoiceStatus,
  ];
}

/** Load executed AR contracts for a portal with the same filters/sort as the dashboard. */
export async function queryAccountingList(filters: AccountingListFilters): Promise<{
  rows: AccountingListExportRow[];
  productLabel: string;
  includeSalesRep: boolean;
}> {
  const productKey = filters.productKey;
  const invoice = parseInvoiceFilter(filters.invoice);
  const q = filters.q?.trim() ?? '';
  const repQ = filters.rep?.trim() ?? '';
  const eventId = filters.eventId?.trim() ?? '';
  const sort = parseSortKey(filters.sort);
  const dir = parseSortDir(filters.dir, sort);
  const limit = Math.min(Math.max(filters.limit ?? 2000, 1), 5000);

  const supabase = getSupabaseAdmin();
  const [{ data: eventsData }, { data: allExecutedRows }] = await Promise.all([
    supabase.from('events').select('*'),
    supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('status', 'executed')
      .order('executed_at', { ascending: false })
      .limit(2000),
  ]);

  const events = (eventsData ?? []) as Event[];
  const eventMap = new Map(events.map((e) => [e.id, e]));
  let contracts = filterContractsByAccountingPortal(
    (allExecutedRows ?? []) as ContractWithTotals[],
    events,
    productKey,
  );

  if (invoice !== 'all') {
    contracts = contracts.filter((c) => (c.invoice_status ?? 'pending') === invoice);
  }
  if (eventId) {
    contracts = contracts.filter((c) => c.event_id === eventId);
  }
  if (q) {
    const lower = q.toLowerCase();
    contracts = contracts.filter((c) => {
      const blob = [
        c.exhibitor_company_name,
        c.billing_contact_name,
        c.billing_contact_email,
        c.signer_1_name,
        c.signer_1_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(lower);
    });
  }
  if (repQ && showSalesRep(productKey)) {
    const lower = repQ.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        (c.sales_rep_name ?? '').toLowerCase().includes(lower) ||
        (c.sales_rep_email ?? '').toLowerCase().includes(lower),
    );
  }

  contracts = [...contracts].sort((a, b) => {
    const mul = dir === 'asc' ? 1 : -1;
    const evA = eventMap.get(a.event_id)?.name ?? '';
    const evB = eventMap.get(b.event_id)?.name ?? '';
    let cmp = 0;
    switch (sort) {
      case 'company':
        cmp = a.exhibitor_company_name.localeCompare(b.exhibitor_company_name);
        break;
      case 'event':
        cmp = evA.localeCompare(evB);
        break;
      case 'total':
        cmp = (a.grand_total_cents ?? 0) - (b.grand_total_cents ?? 0);
        break;
      case 'executed':
        cmp = (a.executed_at ?? '').localeCompare(b.executed_at ?? '');
        break;
      case 'invoice':
        cmp =
          invoiceSortRank((a.invoice_status ?? 'pending') as InvoiceStatus) -
          invoiceSortRank((b.invoice_status ?? 'pending') as InvoiceStatus);
        break;
      case 'rep':
        cmp = (a.sales_rep_name ?? a.sales_rep_email ?? '').localeCompare(
          b.sales_rep_name ?? b.sales_rep_email ?? '',
        );
        break;
    }
    if (cmp !== 0) return cmp * mul;
    return (b.executed_at ?? '').localeCompare(a.executed_at ?? '');
  });

  const rows: AccountingListExportRow[] = contracts.slice(0, limit).map((c) => {
    const ev = eventMap.get(c.event_id);
    const inv = (c.invoice_status ?? 'pending') as InvoiceStatus;
    return {
      company: c.exhibitor_company_name,
      event: ev?.name ?? '',
      billingContact: c.billing_contact_name?.trim() || '',
      billingEmail: c.billing_contact_email?.trim() || '',
      total: formatCurrency(c.grand_total_cents),
      totalCents: c.grand_total_cents ?? 0,
      salesRep: c.sales_rep_name ?? c.sales_rep_email ?? '',
      executed: c.executed_at ? formatTimestamp(c.executed_at) : '',
      invoiceStatus: formatInvoiceStatus(inv),
    };
  });

  return {
    rows,
    productLabel: accountingPortalLabel(productKey),
    includeSalesRep: showSalesRep(productKey),
  };
}

export function buildAccountingListCsv(
  rows: AccountingListExportRow[],
  productKey: AccountingPortalKey,
): string {
  const headers = accountingListHeaders(productKey);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      accountingListRowCells(row, productKey)
        .map((cell) => {
          if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
          return cell;
        })
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export async function buildAccountingListExcel(
  rows: AccountingListExportRow[],
  productKey: AccountingPortalKey,
  productLabel: string,
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'M. Shanken Contracts';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('AR list', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = accountingListHeaders(productKey);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDEFF1' },
  };

  for (const row of rows) {
    sheet.addRow(accountingListRowCells(row, productKey));
  }

  sheet.columns = headers.map((h) => ({
    header: h,
    width: h === 'Company' || h === 'Event' ? 28 : h === 'Billing email' ? 28 : 16,
  }));

  const title = workbook.addWorksheet('About');
  title.addRow([`${productLabel} accounting export`]);
  title.addRow([`Generated ${new Date().toISOString()}`]);
  title.addRow([`${rows.length} row(s)`]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function getExportAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getExportAuth() });
}

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function arListSpreadsheetTitle(productKey: AccountingPortalKey): string {
  if (productKey === 'wine_spectator') return 'NYWE Accounting AR Export';
  if (productKey === 'big_smoke') return 'Big Smoke Accounting AR Export';
  return 'WhiskyFest Accounting AR Export';
}

async function resolveExportFolderId(): Promise<string> {
  const explicit =
    process.env['GOOGLE_BILLED_EXPORT_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_DRIVE_ROOT_FOLDER_ID']?.trim();
  if (explicit) return explicit;

  const drive = getDriveClient();
  const fallbackFileId =
    process.env['GOOGLE_DRAFTS_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_SIGNED_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_TEMPLATE_DOC_ID']?.trim();

  if (fallbackFileId) {
    const meta = await drive.files.get({
      fileId: fallbackFileId,
      fields: 'parents',
      supportsAllDrives: true,
    });
    const parent = meta.data.parents?.[0];
    if (parent) return parent;
  }

  throw new Error(
    'Could not resolve a Google Drive folder for AR exports. Set GOOGLE_BILLED_EXPORT_FOLDER_ID or GOOGLE_DRIVE_ROOT_FOLDER_ID.',
  );
}

async function getOrCreateArListSpreadsheet(
  productKey: AccountingPortalKey,
): Promise<{ spreadsheetId: string; webViewLink: string }> {
  const folderId = await resolveExportFolderId();
  const title = arListSpreadsheetTitle(productKey);
  const drive = getDriveClient();

  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name='${title.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });

  const found = existing.data.files?.[0];
  if (found?.id) {
    return {
      spreadsheetId: found.id,
      webViewLink: found.webViewLink ?? `https://docs.google.com/spreadsheets/d/${found.id}/edit`,
    };
  }

  const created = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  if (!created.data.id) throw new Error('Google Drive did not return a spreadsheet id.');
  return {
    spreadsheetId: created.data.id,
    webViewLink: created.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${created.data.id}/edit`,
  };
}

async function ensureTab(spreadsheetId: string, tabName: string): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === tabName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });
}

/** Full refresh of the filtered AR list into a Google Sheet (separate from billed export). */
export async function exportAccountingListToGoogleSheet(filters: AccountingListFilters): Promise<{
  spreadsheetId: string;
  webViewLink: string;
  rowCount: number;
  productLabel: string;
  tab: string;
}> {
  const { rows, productLabel } = await queryAccountingList({ ...filters, limit: 5000 });
  const { spreadsheetId, webViewLink } = await getOrCreateArListSpreadsheet(filters.productKey);
  const tab = 'AR list';
  await ensureTab(spreadsheetId, tab);

  const headers = accountingListHeaders(filters.productKey);
  const values = [headers, ...rows.map((row) => accountingListRowCells(row, filters.productKey))];

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: tabRange(tab, 'A1:Z10000'),
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tabRange(tab, 'A1'),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return {
    spreadsheetId,
    webViewLink,
    rowCount: rows.length,
    productLabel,
    tab,
  };
}
