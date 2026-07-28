import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  accountingPortalLabel,
  filterContractsByAccountingPortal,
  type AccountingPortalKey,
} from '@/lib/accounting-portal';
import { formatBrandsList, formatBoothAmount, getSalesRepName, getSheetsClient, parseBrandsFromContract } from '@/lib/sheets-tracker';
import { formatInvoiceStatus } from '@/lib/invoice-status';
import { formatTimestamp } from '@/lib/utils';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

const DEFAULT_TAB = 'Billed Exhibitors';

function getBilledExportAuth() {
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
  return google.drive({ version: 'v3', auth: getBilledExportAuth() });
}

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function spreadsheetTitle(productKey: AccountingPortalKey): string {
  if (productKey === 'wine_spectator') return 'NYWE Billed Exhibitors';
  if (productKey === 'big_smoke') return 'Big Smoke Billed Exhibitors';
  return 'WhiskyFest Billed Exhibitors';
}

function configuredSpreadsheetId(productKey: AccountingPortalKey): string | null {
  const envKey =
    productKey === 'wine_spectator'
      ? 'SHEETS_BILLED_NYWE_ID'
      : productKey === 'big_smoke'
        ? 'SHEETS_BILLED_BIG_SMOKE_ID'
        : 'SHEETS_BILLED_WHISKYFEST_ID';
  return process.env[envKey]?.trim() || null;
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
    'Could not resolve a Google Drive folder for billed exports. Set GOOGLE_BILLED_EXPORT_FOLDER_ID or ensure GOOGLE_DRAFTS_FOLDER_ID is configured.',
  );
}

function exportTabName(): string {
  return process.env['SHEETS_BILLED_TAB']?.trim() || DEFAULT_TAB;
}

function formatBillingAddress(c: ContractWithTotals): string {
  return [
    c.billing_address_line1,
    c.billing_address_line2,
    [c.billing_city, c.billing_state, c.billing_zip].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatTimestamp(iso);
}

async function getOrCreateSpreadsheet(productKey: AccountingPortalKey): Promise<{ spreadsheetId: string; webViewLink: string }> {
  const configured = configuredSpreadsheetId(productKey);
  if (configured) {
    const drive = getDriveClient();
    const file = await drive.files.get({
      fileId: configured,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    if (!file.data.id) throw new Error('Configured billed export spreadsheet was not found.');
    return {
      spreadsheetId: file.data.id,
      webViewLink: file.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.data.id}/edit`,
    };
  }

  const folderId = await resolveExportFolderId();
  const title = spreadsheetTitle(productKey);
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

function headersForProduct(productKey: AccountingPortalKey): string[] {
  if (productKey === 'wine_spectator') {
    return [
      'Company',
      'Event',
      'Wine / brands',
      'Total',
      'Invoice status',
      'Invoice sent',
      'Paid',
      'Billing contact',
      'Billing email',
      'Billing street',
      'Billing city',
      'Billing state',
      'Billing zip',
      'Signer',
      'Signer email',
      'Executed',
      'Contract ID',
      'Accounting notes',
    ];
  }

  return [
    'Company',
    'Event',
    'Sales rep',
    'Booths',
    'Brands',
    'Total',
    'Invoice status',
    'Invoice sent',
    'Paid',
    'Billing contact',
    'Billing email',
    'Billing address',
    'Signer',
    'Signer email',
    'Executed',
    'Contract ID',
    'Accounting notes',
  ];
}

async function buildRow(
  contract: ContractWithTotals,
  event: Event | undefined,
  productKey: AccountingPortalKey,
): Promise<string[]> {
  const inv = (contract.invoice_status ?? 'pending') as InvoiceStatus;

  if (productKey === 'wine_spectator') {
    return [
      contract.exhibitor_company_name,
      event?.name ?? '',
      formatBrandsList(parseBrandsFromContract(contract.brands_poured)),
      formatBoothAmount(contract.grand_total_cents ?? 0),
      formatInvoiceStatus(inv),
      formatIsoDate(contract.invoice_sent_at),
      formatIsoDate(contract.paid_at),
      contract.billing_contact_name?.trim() ?? '',
      contract.billing_contact_email?.trim() ?? '',
      contract.billing_address_line1?.trim() ?? '',
      contract.billing_city?.trim() ?? '',
      contract.billing_state?.trim() ?? '',
      contract.billing_zip?.trim() ?? '',
      contract.signer_1_name?.trim() ?? '',
      contract.signer_1_email?.trim() ?? '',
      formatIsoDate(contract.executed_at),
      contract.id,
      contract.accounting_notes?.trim() ?? '',
    ];
  }

  const rep = await getSalesRepName(contract);
  return [
    contract.exhibitor_company_name,
    event?.name ?? '',
    rep,
    String(contract.booth_count ?? ''),
    formatBrandsList(parseBrandsFromContract(contract.brands_poured)),
    formatBoothAmount(contract.grand_total_cents ?? 0),
    formatInvoiceStatus(inv),
    formatIsoDate(contract.invoice_sent_at),
    formatIsoDate(contract.paid_at),
    contract.billing_contact_name?.trim() ?? contract.signer_1_name?.trim() ?? '',
    contract.billing_contact_email?.trim() ?? contract.signer_1_email?.trim() ?? '',
    formatBillingAddress(contract),
    contract.signer_1_name?.trim() ?? '',
    contract.signer_1_email?.trim() ?? '',
    formatIsoDate(contract.executed_at),
    contract.id,
    contract.accounting_notes?.trim() ?? '',
  ];
}

export type BilledExportResult = {
  spreadsheetId: string;
  webViewLink: string;
  rowCount: number;
  productLabel: string;
  tab: string;
};

/** Full refresh of billed exhibitors (invoice sent + paid) into Google Sheets. */
export async function exportBilledExhibitorsToGoogleSheet(
  productKey: AccountingPortalKey,
): Promise<BilledExportResult> {
  const supabase = getSupabaseAdmin();
  const [{ data: eventsData }, { data: rows }] = await Promise.all([
    supabase.from('events').select('*'),
    supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('status', 'executed')
      .in('invoice_status', ['invoice_sent', 'paid'])
      .order('invoice_sent_at', { ascending: false, nullsFirst: false })
      .limit(5000),
  ]);

  const events = (eventsData ?? []) as Event[];
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const billed = filterContractsByAccountingPortal((rows ?? []) as ContractWithTotals[], events, productKey);

  const { spreadsheetId, webViewLink } = await getOrCreateSpreadsheet(productKey);
  const tab = exportTabName();
  await ensureTab(spreadsheetId, tab);

  const headers = headersForProduct(productKey);
  const dataRows: string[][] = [];
  for (const contract of billed) {
    dataRows.push(await buildRow(contract, eventMap.get(contract.event_id), productKey));
  }

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: tabRange(tab, 'A1:Z10000'),
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tabRange(tab, 'A1'),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...dataRows] },
  });

  return {
    spreadsheetId,
    webViewLink,
    rowCount: dataRows.length,
    productLabel: accountingPortalLabel(productKey),
    tab,
  };
}

/**
 * Refresh the billed exhibitors sheet for this contract's portal.
 * Call after invoice sent, paid, recall, or contract void so rows stay in sync —
 * non-executed / non-sent contracts are omitted from the export.
 */
export async function syncBilledContractToGoogleSheet(contractId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, event_id')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract) return;

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle<Event>();
  if (!event) return;

  const productKey: AccountingPortalKey =
    event.product_key === 'wine_spectator'
      ? 'wine_spectator'
      : event.product_key === 'big_smoke'
        ? 'big_smoke'
        : 'whiskyfest';

  try {
    await exportBilledExhibitorsToGoogleSheet(productKey);
  } catch (err) {
    console.error('[sheets-billed-export] sync failed', { contractId, err });
  }
}
