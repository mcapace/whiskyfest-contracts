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

/** Cell values for CSV (Total as formatted currency string). */
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

/** Cell values for Excel/Sheets (Total as number for currency formatting). */
function accountingListRichRowCells(
  row: AccountingListExportRow,
  productKey: AccountingPortalKey,
): Array<string | number> {
  return [
    row.company,
    row.event,
    row.billingContact,
    row.billingEmail,
    row.totalCents / 100,
    ...(showSalesRep(productKey) ? [row.salesRep] : []),
    row.executed,
    row.invoiceStatus,
  ];
}

function productTheme(productKey: AccountingPortalKey) {
  if (productKey === 'wine_spectator') {
    return {
      titleBg: '881337',
      accent: 'BE123C',
      headerBg: 'FFF1F2',
      headerFg: '881337',
      altRow: 'FFF7F8',
    };
  }
  if (productKey === 'big_smoke') {
    return {
      titleBg: '78350F',
      accent: 'B45309',
      headerBg: 'FFFBEB',
      headerFg: '78350F',
      altRow: 'FFFCF5',
    };
  }
  return {
    titleBg: '1F2937',
    accent: '3F6212',
    headerBg: 'F0F2F4',
    headerFg: '1F2937',
    altRow: 'F7F8F8',
  };
}

function totalColumnIndex(productKey: AccountingPortalKey): number {
  // 0-based: Company, Event, Billing contact, Billing email, Total
  return 4;
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

  const theme = productTheme(productKey);
  const headers = accountingListHeaders(productKey);
  const colCount = headers.length;
  const totalCol = totalColumnIndex(productKey) + 1; // 1-based for ExcelJS

  const solid = (argb: string) =>
    ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: `FF${argb}` } });

  const sheet = workbook.addWorksheet('AR list', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  sheet.columns = headers.map((h) => ({
    width:
      h === 'Company' || h === 'Event'
        ? 28
        : h === 'Billing email' || h === 'Billing contact'
          ? 26
          : h === 'Invoice status'
            ? 16
            : 14,
  }));

  const generated = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const titleRow = sheet.addRow([`${productLabel} · Accounts receivable`]);
  titleRow.height = 32;
  for (let c = 1; c <= colCount; c++) {
    const cell = titleRow.getCell(c);
    cell.fill = solid(theme.titleBg);
    cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
  sheet.mergeCells(1, 1, 1, colCount);

  const subtitleRow = sheet.addRow([
    `${rows.length} contract${rows.length === 1 ? '' : 's'} · Generated ${generated}`,
  ]);
  subtitleRow.height = 20;
  for (let c = 1; c <= colCount; c++) {
    const cell = subtitleRow.getCell(c);
    cell.fill = solid('F3F4F6');
    cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
  sheet.mergeCells(2, 1, 2, colCount);

  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = solid(theme.headerBg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${theme.headerFg}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: `FF${theme.accent}` } },
    };
  });
  headerRow.getCell(totalCol).alignment = { vertical: 'middle', horizontal: 'right' };

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow(accountingListRichRowCells(row, productKey));
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: colNumber === 1,
        color: { argb: 'FF1F2937' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === totalCol ? 'right' : 'left',
        wrapText: true,
      };
      if (index % 2 === 1) cell.fill = solid(theme.altRow);
      if (colNumber === totalCol) {
        cell.numFmt = '"$"#,##0.00';
      }
    });
  });

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

async function ensureTab(spreadsheetId: string, tabName: string): Promise<number> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === tabName);
  if (existing?.properties?.sheetId != null) return existing.properties.sheetId;

  const added = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });
  const sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId == null) throw new Error('Could not create Google Sheets tab.');
  return sheetId;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const n = Number.parseInt(hex, 16);
  return {
    red: ((n >> 16) & 255) / 255,
    green: ((n >> 8) & 255) / 255,
    blue: (n & 255) / 255,
  };
}

/** Full refresh of the filtered AR list into a formatted Google Sheet. */
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
  const sheetId = await ensureTab(spreadsheetId, tab);

  const headers = accountingListHeaders(filters.productKey);
  const colCount = headers.length;
  const totalCol = totalColumnIndex(filters.productKey);
  const theme = productTheme(filters.productKey);
  const generated = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const values: Array<Array<string | number>> = [
    [`${productLabel} · Accounts receivable`],
    [`${rows.length} contract${rows.length === 1 ? '' : 's'} · Generated ${generated}`],
    headers,
    ...rows.map((row) => accountingListRichRowCells(row, filters.productKey)),
  ];

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

  const endRow = values.length;
  const dataStart = 3; // 0-based row index of first data row
  const widths = showSalesRep(filters.productKey)
    ? [200, 200, 160, 200, 110, 140, 130, 120]
    : [200, 200, 160, 200, 110, 130, 120];

  const requests: object[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 3 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    ...widths.map((pixelSize, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })),
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: colCount },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            textFormat: { fontFamily: 'Arial', fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb(theme.titleBg),
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 16,
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 },
            },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.96 },
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 9,
              italic: true,
              foregroundColor: { red: 0.42, green: 0.45, blue: 0.5 },
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb(theme.headerBg),
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 10,
              bold: true,
              foregroundColor: hexToRgb(theme.headerFg),
            },
            borders: {
              bottom: { style: 'SOLID', width: 1, color: hexToRgb(theme.accent) },
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,borders)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: dataStart,
          endRowIndex: endRow,
          startColumnIndex: totalCol,
          endColumnIndex: totalCol + 1,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: dataStart,
          endRowIndex: endRow,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
  ];

  // Zebra striping for odd data rows
  for (let r = dataStart; r < endRow; r++) {
    if ((r - dataStart) % 2 !== 1) continue;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: { userEnteredFormat: { backgroundColor: hexToRgb(theme.altRow) } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return {
    spreadsheetId,
    webViewLink,
    rowCount: rows.length,
    productLabel,
    tab,
  };
}
