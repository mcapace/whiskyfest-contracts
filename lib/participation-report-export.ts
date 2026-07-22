import { google, sheets_v4 } from 'googleapis';
import {
  buildParticipationReport,
  type ParticipationReport,
  type ParticipationReportRow,
} from '@/lib/participation-report';
import { PARTICIPATION_REPORT_ALLOWED_EMAILS } from '@/lib/participation-report-shared';
import { formatBoothAmount, getSheetsClient } from '@/lib/sheets-tracker';

type SheetsRequest = sheets_v4.Schema$Request;

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

function notesCell(row: ParticipationReportRow): string {
  return [
    row.pipeline_status !== 'No contract' ? row.pipeline_status : '',
    row.sheet_notes ? `Sheet: ${row.sheet_notes}` : '',
    row.notes ? `Portal: ${row.notes}` : '',
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

function dataRow(row: ParticipationReportRow, includeNotes: boolean): (string | number)[] {
  const base: (string | number)[] = [
    row.sales_rep_initials,
    row.company_name,
    row.brands_text,
    row.booth_count || '',
    rateLabel(row.rate_per_booth_cents),
    row.sponsorship_label,
    money(row.total_spend_cents),
  ];
  if (includeNotes) base.push(notesCell(row));
  return base;
}

type RowKind = 'title' | 'subtitle' | 'blank' | 'section' | 'header' | 'data' | 'total' | 'grand';

type BuiltSheet = {
  values: (string | number)[][];
  kinds: RowKind[];
  colCount: number;
};

const COL_COUNT = 8;

const COLORS = {
  titleBg: { red: 0.12, green: 0.16, blue: 0.22 },
  titleFg: { red: 1, green: 1, blue: 1 },
  confirmedBg: { red: 0.18, green: 0.49, blue: 0.33 },
  pendingBg: { red: 0.72, green: 0.45, blue: 0.14 },
  newBizBg: { red: 0.22, green: 0.37, blue: 0.55 },
  headerBg: { red: 0.93, green: 0.94, blue: 0.95 },
  totalBg: { red: 0.95, green: 0.95, blue: 0.93 },
  grandBg: { red: 0.12, green: 0.16, blue: 0.22 },
  altRow: { red: 0.97, green: 0.98, blue: 0.98 },
  white: { red: 1, green: 1, blue: 1 },
};

/** Marvin-style sheet values + row kind map for formatting. */
export function buildParticipationSheetValues(report: ParticipationReport): BuiltSheet {
  const title = `${report.event.name} ${report.event.year} | Company Participation Status`;
  const asOf = report.sheetsFetchedAt
    ? `As of ${new Date(report.sheetsFetchedAt).toLocaleString()} · Confirmed from executed contracts · Pending/New Business live from Google Sheets`
    : `Generated ${new Date().toLocaleString()}`;

  const values: (string | number)[][] = [];
  const kinds: RowKind[] = [];

  const push = (row: (string | number)[], kind: RowKind) => {
    const padded = [...row];
    while (padded.length < COL_COUNT) padded.push('');
    values.push(padded.slice(0, COL_COUNT));
    kinds.push(kind);
  };

  push([title], 'title');
  push([asOf], 'subtitle');
  push([], 'blank');

  push(['CONFIRMED'], 'section');
  push(
    ['Sales Rep', 'Company', 'Participating Brand(s)', '# of Booths', 'Rate per Booth', 'Sponsorship (Y/N)', 'Total Spend', ''],
    'header',
  );
  for (const row of report.confirmed) push(dataRow(row, false), 'data');
  push(['TOTAL', '', '', report.totals.confirmedBooths, '', '', money(report.totals.confirmedSpendCents), ''], 'total');
  push([], 'blank');

  push(['PENDING RENEWALS'], 'section');
  push(
    ['Sales Rep', 'Company', 'Brand(s)', '# of Booths', 'Rate per Booth', 'Sponsorship (Y/N)', 'Total Spend', 'Notes'],
    'header',
  );
  for (const row of report.pending) push(dataRow(row, true), 'data');
  push(['TOTAL', '', '', report.totals.pendingBooths, '', '', money(report.totals.pendingSpendCents), ''], 'total');
  push([], 'blank');
  push([], 'blank');

  push(['NEW BUSINESS — Inquiry Tracking'], 'section');
  push(
    ['Sales Rep', 'Company', 'Brands / Notes', '# of Booths', 'Rate per Booth', 'Sponsorship', 'Total Spend', 'Notes'],
    'header',
  );
  for (const row of report.newBusiness) push(dataRow(row, true), 'data');
  const newBizBooths = report.newBusiness.reduce((a, r) => a + (r.booth_count || 0), 0);
  const newBizSpend = report.newBusiness.reduce((a, r) => a + (r.total_spend_cents || 0), 0);
  push(['TOTAL', '', '', newBizBooths || '', '', '', newBizSpend ? money(newBizSpend) : '', ''], 'total');
  push([], 'blank');
  push([], 'blank');

  push(
    [
      'TOTAL CONFIRMED + PENDING',
      '',
      '',
      report.totals.confirmedPlusPendingBooths,
      '',
      '',
      money(report.totals.confirmedPlusPendingSpendCents),
      '',
    ],
    'grand',
  );

  return { values, kinds, colCount: COL_COUNT };
}

function formatRequests(sheetId: number, built: BuiltSheet): SheetsRequest[] {
  const { kinds, colCount } = built;
  const requests: SheetsRequest[] = [];

  // Column widths
  const widths = [90, 200, 320, 90, 110, 120, 110, 280];
  widths.forEach((pixelSize, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    });
  });

  // Default font + wrap for whole used range
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: kinds.length, startColumnIndex: 0, endColumnIndex: colCount },
      cell: {
        userEnteredFormat: {
          textFormat: { fontFamily: 'Arial', fontSize: 10 },
          verticalAlignment: 'TOP',
          wrapStrategy: 'WRAP',
        },
      },
      fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
    },
  });

  // Merge title + subtitle across columns
  requests.push({
    mergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
      mergeType: 'MERGE_ALL',
    },
  });
  requests.push({
    mergeCells: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: colCount },
      mergeType: 'MERGE_ALL',
    },
  });

  let sectionTone: 'confirmed' | 'pending' | 'new' | null = null;

  kinds.forEach((kind, rowIndex) => {
    const range = {
      sheetId,
      startRowIndex: rowIndex,
      endRowIndex: rowIndex + 1,
      startColumnIndex: 0,
      endColumnIndex: colCount,
    };

    if (kind === 'title') {
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: COLORS.titleBg,
              textFormat: { fontFamily: 'Arial', fontSize: 16, bold: true, foregroundColor: COLORS.titleFg },
              verticalAlignment: 'MIDDLE',
              horizontalAlignment: 'LEFT',
              padding: { top: 8, bottom: 8, left: 10, right: 10 },
            },
          },
          fields:
            'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,padding)',
        },
      });
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          properties: { pixelSize: 40 },
          fields: 'pixelSize',
        },
      });
      return;
    }

    if (kind === 'subtitle') {
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.95, blue: 0.96 },
              textFormat: { fontFamily: 'Arial', fontSize: 9, italic: true, foregroundColor: { red: 0.35, green: 0.38, blue: 0.42 } },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
        },
      });
      return;
    }

    if (kind === 'section') {
      const label = String(built.values[rowIndex]?.[0] ?? '').toUpperCase();
      if (label.includes('CONFIRMED') && !label.includes('PENDING')) sectionTone = 'confirmed';
      else if (label.includes('PENDING')) sectionTone = 'pending';
      else if (label.includes('NEW BUSINESS')) sectionTone = 'new';

      const bg =
        sectionTone === 'confirmed'
          ? COLORS.confirmedBg
          : sectionTone === 'pending'
            ? COLORS.pendingBg
            : COLORS.newBizBg;

      requests.push({
        mergeCells: {
          range,
          mergeType: 'MERGE_ALL',
        },
      });
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: bg,
              textFormat: { fontFamily: 'Arial', fontSize: 11, bold: true, foregroundColor: COLORS.white },
              verticalAlignment: 'MIDDLE',
              padding: { top: 4, bottom: 4, left: 8, right: 8 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
        },
      });
      return;
    }

    if (kind === 'header') {
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: COLORS.headerBg,
              textFormat: { fontFamily: 'Arial', fontSize: 9, bold: true },
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              borders: {
                bottom: { style: 'SOLID', width: 1, color: { red: 0.75, green: 0.78, blue: 0.8 } },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
        },
      });
      // Right-align numeric header labels
      for (const col of [3, 4, 5, 6]) {
        requests.push({
          repeatCell: {
            range: { ...range, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } },
            fields: 'userEnteredFormat.horizontalAlignment',
          },
        });
      }
      return;
    }

    if (kind === 'data') {
      const alt = rowIndex % 2 === 0;
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: alt ? COLORS.altRow : COLORS.white,
              textFormat: { fontFamily: 'Arial', fontSize: 10 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
      for (const col of [3, 4, 5, 6]) {
        requests.push({
          repeatCell: {
            range: { ...range, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } },
            fields: 'userEnteredFormat.horizontalAlignment',
          },
        });
      }
      // Bold company name
      requests.push({
        repeatCell: {
          range: { ...range, startColumnIndex: 1, endColumnIndex: 2 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      });
      return;
    }

    if (kind === 'total') {
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: COLORS.totalBg,
              textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true },
              borders: {
                top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.82, blue: 0.84 } },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,borders)',
        },
      });
      for (const col of [3, 6]) {
        requests.push({
          repeatCell: {
            range: { ...range, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } },
            fields: 'userEnteredFormat.horizontalAlignment',
          },
        });
      }
      return;
    }

    if (kind === 'grand') {
      requests.push({
        mergeCells: {
          range: { ...range, endColumnIndex: 3 },
          mergeType: 'MERGE_ALL',
        },
      });
      requests.push({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              backgroundColor: COLORS.grandBg,
              textFormat: { fontFamily: 'Arial', fontSize: 11, bold: true, foregroundColor: COLORS.white },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
        },
      });
      for (const col of [3, 6]) {
        requests.push({
          repeatCell: {
            range: { ...range, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'RIGHT',
                textFormat: { bold: true, foregroundColor: COLORS.white },
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
          },
        });
      }
    }
  });

  // Freeze title + subtitle; hide gridlines for a cleaner report look
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 2, hideGridlines: true },
      },
      fields: 'gridProperties.frozenRowCount,gridProperties.hideGridlines',
    },
  });

  return requests;
}

export function buildParticipationCsv(report: ParticipationReport): string {
  // Same Marvin layout as Excel/Sheets (structure). CSV cannot carry colors;
  // open Excel or Google Sheets export for full formatting.
  const built = buildParticipationSheetValues(report);
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = built.values.map((row) => row.map(esc).join(','));
  // UTF-8 BOM so Excel opens currency/accents correctly
  return `\uFEFF${lines.join('\n')}`;
}

/** Formatted .xlsx buffer matching the Marvin / Google Sheets participation layout. */
export async function buildParticipationExcel(report: ParticipationReport): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const built = buildParticipationSheetValues(report);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WhiskyFest Contracts';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Participation Status', {
    views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  sheet.columns = [
    { width: 12 },
    { width: 28 },
    { width: 42 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 36 },
  ];

  const hex = {
    titleBg: '1F2937',
    titleFg: 'FFFFFF',
    subtitleBg: 'F0F2F4',
    subtitleFg: '59636B',
    confirmedBg: '2E7D54',
    pendingBg: 'B87324',
    newBizBg: '182D6D',
    headerBg: 'EDEFF1',
    headerBorder: 'BFC5CC',
    totalBg: 'F2F2ED',
    totalBorder: 'CCD0D4',
    grandBg: '1F2937',
    altRow: 'F7F8F8',
    white: 'FFFFFF',
  };

  const solid = (argb: string) =>
    ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: `FF${argb}` } });

  let sectionTone: 'confirmed' | 'pending' | 'new' = 'confirmed';
  let dataStripe = 0;

  built.values.forEach((cells, rowIndex) => {
    const kind = built.kinds[rowIndex]!;
    const excelRow = sheet.addRow(cells);

    if (kind === 'title') excelRow.height = 36;
    else if (kind === 'section') excelRow.height = 24;
    else if (kind === 'header' || kind === 'total' || kind === 'grand') excelRow.height = 20;
    else excelRow.height = 18;

    // Ensure empty cells still get fills (section / title bars)
    for (let c = 1; c <= built.colCount; c++) {
      if (!excelRow.getCell(c).value && cells[c - 1] === '') {
        excelRow.getCell(c).value = '';
      }
    }

    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const isNumericCol = colNumber >= 4 && colNumber <= 7;
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: isNumericCol ? 'right' : 'left',
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };

      if (kind === 'title') {
        cell.fill = solid(hex.titleBg);
        cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: `FF${hex.titleFg}` } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (kind === 'subtitle') {
        cell.fill = solid(hex.subtitleBg);
        cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: `FF${hex.subtitleFg}` } };
      } else if (kind === 'section') {
        const label = String(cells[0] ?? '').toUpperCase();
        if (label.includes('CONFIRMED') && !label.includes('PENDING')) sectionTone = 'confirmed';
        else if (label.includes('PENDING')) sectionTone = 'pending';
        else if (label.includes('NEW BUSINESS')) sectionTone = 'new';
        dataStripe = 0;

        const bg =
          sectionTone === 'confirmed'
            ? hex.confirmedBg
            : sectionTone === 'pending'
              ? hex.pendingBg
              : hex.newBizBg;
        cell.fill = solid(bg);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${hex.white}` } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (kind === 'header') {
        cell.fill = solid(hex.headerBg);
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F2937' } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: `FF${hex.headerBorder}` } },
        };
      } else if (kind === 'data') {
        if (dataStripe % 2 === 1) cell.fill = solid(hex.altRow);
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colNumber === 2,
          color: { argb: 'FF1F2937' },
        };
      } else if (kind === 'total') {
        cell.fill = solid(hex.totalBg);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
        cell.border = {
          top: { style: 'thin', color: { argb: `FF${hex.totalBorder}` } },
        };
      } else if (kind === 'grand') {
        cell.fill = solid(hex.grandBg);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${hex.white}` } };
      } else if (kind === 'blank') {
        cell.font = { name: 'Calibri', size: 10 };
      }
    });

    if (kind === 'data') dataStripe += 1;
  });

  // Merges — title, subtitle, section banners, grand label
  sheet.mergeCells(1, 1, 1, built.colCount);
  sheet.mergeCells(2, 1, 2, built.colCount);
  built.kinds.forEach((kind, i) => {
    const rowNum = i + 1;
    if (kind === 'section') {
      sheet.mergeCells(rowNum, 1, rowNum, built.colCount);
    }
    if (kind === 'grand') {
      sheet.mergeCells(rowNum, 1, rowNum, 3);
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ParticipationExportResult = {
  spreadsheetId: string;
  webViewLink: string;
  title: string;
};

function normalizeShareEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Grant editor access so Kate/Michael (and any extras) can open the export immediately. */
async function shareParticipationSpreadsheet(
  drive: ReturnType<typeof getDriveClient>,
  spreadsheetId: string,
  emails: string[],
  notifyEmail: string | null,
) {
  const notify = notifyEmail?.trim().toLowerCase() || null;
  const failures: string[] = [];

  for (const email of emails) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        supportsAllDrives: true,
        sendNotificationEmail: Boolean(notify && email === notify),
        fields: 'id',
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: email,
        },
      });
    } catch (err) {
      console.error('[participation-export] share failed', email, err);
      failures.push(email);
    }
  }

  // If we couldn't share with the person who exported, try anyone-with-link as editor
  // so the Open spreadsheet button still works without a Google "Request access" wall.
  if (notify && failures.includes(notify)) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        fields: 'id',
        requestBody: {
          type: 'anyone',
          role: 'writer',
          allowFileDiscovery: false,
        },
      });
    } catch (err) {
      console.error('[participation-export] anyone-with-link fallback failed', err);
      throw new Error(
        `Spreadsheet was created but could not be shared with ${notify}. Ask an admin to open it and share, or set GOOGLE_PARTICIPATION_EXPORT_FOLDER_ID to a Shared Drive Kate can access.`,
      );
    }
  }
}

/** Create a dated, formatted Google Spreadsheet in Marvin layout and return its link. */
export async function exportParticipationReportToGoogleSheet(options?: {
  eventId?: string | null;
  /** Email of the person who clicked Export — always gets editor access. */
  shareWithEmail?: string | null;
}): Promise<ParticipationExportResult> {
  const report = await buildParticipationReport({ eventId: options?.eventId });
  if (!report) throw new Error('No active WhiskyFest event found');

  const built = buildParticipationSheetValues(report);
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
  const sheetId = meta.data.sheets?.[0]?.properties?.sheetId;
  const tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
  if (sheetId == null) throw new Error('Spreadsheet has no sheet tab');

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tabRange(tab, 'A1'),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: built.values },
  });

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
        ...formatRequests(sheetId, built),
      ],
    },
  });

  const envExtras = (process.env['GOOGLE_PARTICIPATION_EXPORT_SHARE_EMAILS'] ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const shareEmails = normalizeShareEmails([
    options?.shareWithEmail,
    ...PARTICIPATION_REPORT_ALLOWED_EMAILS,
    ...envExtras,
  ]);
  await shareParticipationSpreadsheet(
    drive,
    spreadsheetId,
    shareEmails,
    options?.shareWithEmail ?? null,
  );

  const webViewLink =
    created.data.webViewLink ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { spreadsheetId, webViewLink, title };
}
