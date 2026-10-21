import { google } from 'googleapis';

function getAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });
}

type DocElement = {
  paragraph?: { elements?: Array<{ textRun?: { content?: string } }> };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: DocElement[];
      }>;
    }>;
  };
};

function collectParagraphText(el: DocElement): string {
  let out = '';
  for (const run of el.paragraph?.elements ?? []) {
    out += run.textRun?.content ?? '';
  }
  return out;
}

function collectElementText(el: DocElement): string {
  let out = collectParagraphText(el);
  for (const row of el.table?.tableRows ?? []) {
    for (const cell of row.tableCells ?? []) {
      for (const cellEl of cell.content ?? []) {
        out += collectElementText(cellEl);
      }
    }
  }
  return out;
}

/**
 * Read plain text from a Google Doc (template or temp copy). With `includeTables: false` only
 * body paragraphs are returned — the CONTRACT ORDER table is generated at render time and clause
 * edits can never target it, so the revision planner must not see it as editable text.
 */
export async function fetchGoogleDocPlainText(
  documentId: string,
  options?: { includeTables?: boolean },
): Promise<string> {
  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });
  const { data } = await docs.documents.get({ documentId });
  const includeTables = options?.includeTables !== false;
  let plain = '';
  for (const el of data.body?.content ?? []) {
    plain += includeTables ? collectElementText(el as DocElement) : collectParagraphText(el as DocElement);
  }
  return plain;
}
