import { google } from 'googleapis';
import {
  buildParticipationReport,
  type ParticipationReport,
  type ParticipationReportRow,
} from '@/lib/participation-report';
import { formatBoothAmount, getSheetsClient } from '@/lib/sheets-tracker';

function getDriveAuth() {
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
  return google.drive({ version: 'v3', auth: getDriveAuth() });
}

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

async function resolveExportFolderId(): Promise<string> {
  const explicit =
    process.env['GOOGLE_PARTICIPATION_EXPORT_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_BILLED_EXPORT_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_DRIVE_ROOT_FOLDER_ID']?.trim();
  if (explicit) return explicit;

  const drive = getDriveClient();
  const fallbackFileId =
    process.env['GOOGLE_DRAFTS_FOLDER_ID']?.trim() ||
    process.env['GOOGLE_SIGNED_FOLDER_ID']?.trim() ||
    process.env['SHEETS_TRACKER_ID']?.trim();

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
    'Could not resolve a Google Drive folder for participation exports. Set GOOGLE_PARTICIPATION_EXPORT_FOLDER_ID or GOOGLE_BILLED_EXPORT_FOLDER_ID.',
  );
}

function money(cents: number): string {
  if (!cents) return '$0';
  return formatBoothAmount(cents);
}

function rateLabel(cents: number): string {
  if (!cents) return '';
  return money(cents);
}

function dataRow(row: ParticipationReportRow, includeNotes: boolean): string[] {
  const base = [
    row.sales_rep_initials,
    row.company_name,
    row.brands_text,
    row.booth_count ? String(row.booth_count) : '',
    rateLabel(row.rate_per_booth_cents),
    row.sponsorship_label,
    money(row.total_spend_cents),
  ];
  if (includeNotes) {
    const noteParts = [row.pipeline_status !== 'No contract' ? row.pipeline_status : '', row.notes]
      .map((s) => s.trim())
      .filter(Boolean);
    base.push(noteParts.join(' — '));
  }
  return base;
}

/** Marvin-style sheet values for Confirmed / Pending / New Business. */
export function buildParticipationSheetValues(report: ParticipationReport): string[][] {
  const title = `${report.event.name} ${report.event.year} | Company Participation Status`;
  const values: string[][] = [[title], []];

  values.push(['CONFIRMED']);
  values.push([
    'Sales Rep',
    'Company',
    'Participating Brand(s)',
    '# of Booths',
    'Rate per Booth',
    'Sponsorship (Y/N)',
    'Total Spend',
  ]);
  for (const row of report.confirmed) values.push(dataRow(row, false));
  values.push([
    'TOTAL',
    String(report.totals.confirmedBooths),
    money(report.totals.confirmedSpendCents),
  ]);
  values.push([]);

  values.push(['PENDING RENEWALS']);
  values.push([
    'Sales Rep',
    'Company',
    'Brand(s)',
    '# of Booths',
    'Rate per Booth',
    'Sponsorship (Y/N)',
    'Total Spend',
    'Notes',
  ]);
  for (const row of report.pending) values.push(dataRow(row, true));
  values.push([
    'TOTAL',
    String(report.totals.pendingBooths),
    money(report.totals.pendingSpendCents),
  ]);
  values.push([]);
  values.push([]);

  values.push(['NEW BUSINESS - Inquiry Tracking']);
  values.push([
    'Sales Rep',
    'Company',
    'Brands',
    '# of Booths',
    'Rate per Booth',
    'Sponsorship',
    'Total Spend',
    'Notes',
  ]);
  for (const row of report.newBusiness) values.push(dataRow(row, true));
  values.push(['TOTAL', '—', '—']);
  values.push([]);
  values.push([]);

  values.push([
    'TOTAL CONFIRMED + PENDING',
    String(report.totals.confirmedPlusPendingBooths),
    money(report.totals.confirmedPlusPendingSpendCents),
  ]);

  return values;
}

export function buildParticipationCsv(report: ParticipationReport): string {
  const lines: string[] = [];
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const push = (cells: (string | number)[]) => lines.push(cells.map(esc).join(','));

  push(['Section', 'Sales Rep', 'Company', 'Brands', 'Booths', 'Rate per Booth', 'Sponsorship', 'Total Spend', 'Notes / Status']);
  for (const row of report.confirmed) {
    push([
      'Confirmed',
      row.sales_rep_initials,
      row.company_name,
      row.brands_text,
      row.booth_count,
      rateLabel(row.rate_per_booth_cents),
      row.sponsorship_label,
      money(row.total_spend_cents),
      '',
    ]);
  }
  for (const row of report.pending) {
    push([
      'Pending Renewals',
      row.sales_rep_initials,
      row.company_name,
      row.brands_text,
      row.booth_count,
      rateLabel(row.rate_per_booth_cents),
      row.sponsorship_label,
      money(row.total_spend_cents),
      [row.pipeline_status, row.notes].filter(Boolean).join(' — '),
    ]);
  }
  for (const row of report.newBusiness) {
    push([
      'New Business',
      row.sales_rep_initials,
      row.company_name,
      row.brands_text,
      row.booth_count,
      rateLabel(row.rate_per_booth_cents),
      row.sponsorship_label,
      money(row.total_spend_cents),
      [row.pipeline_status, row.notes].filter(Boolean).join(' — '),
    ]);
  }
  push([]);
  push(['Confirmed booths', report.totals.confirmedBooths, 'Confirmed spend', money(report.totals.confirmedSpendCents)]);
  push(['Pending booths', report.totals.pendingBooths, 'Pending spend', money(report.totals.pendingSpendCents)]);
  push([
    'Confirmed + Pending booths',
    report.totals.confirmedPlusPendingBooths,
    'Confirmed + Pending spend',
    money(report.totals.confirmedPlusPendingSpendCents),
  ]);

  return lines.join('\n');
}

export type ParticipationExportResult = {
  spreadsheetId: string;
  webViewLink: string;
  title: string;
};

/** Create a dated Google Spreadsheet in Marvin layout and return its link. */
export async function exportParticipationReportToGoogleSheet(options?: {
  eventId?: string | null;
}): Promise<ParticipationExportResult> {
  const report = await buildParticipationReport({ eventId: options?.eventId });
  if (!report) throw new Error('No active WhiskyFest event found');

  const values = buildParticipationSheetValues(report);
  const folderId = await resolveExportFolderId();
  const stamp = new Date().toISOString().slice(0, 10);
  const title = `WF NY ${report.event.year} Participation Status — ${stamp}`;

  const drive = getDriveClient();
  const created = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const spreadsheetId = created.data.id;
  if (!spreadsheetId) throw new Error('Failed to create spreadsheet');

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tabRange(tab, 'A1'),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  // Rename first tab for clarity
  const sheetId = meta.data.sheets?.[0]?.properties?.sheetId;
  if (sheetId != null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, title: 'Participation Status' },
              fields: 'title',
            },
          },
        ],
      },
    });
  }

  const webViewLink =
    created.data.webViewLink ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { spreadsheetId, webViewLink, title };
}
