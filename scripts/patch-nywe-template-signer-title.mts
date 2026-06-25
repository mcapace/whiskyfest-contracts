#!/usr/bin/env npx tsx
/**
 * Removes exhibitor "Title:" line from NYWE Google Doc template (keeps Shanken signatory title).
 *
 * Usage:
 *   npx tsx scripts/patch-nywe-template-signer-title.mts
 */
import { google } from 'googleapis';

const DEFAULT_NYWE_DOC_ID = '1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw';

function getAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents'],
  });
}

type DocElement = {
  startIndex?: number | null;
  endIndex?: number | null;
  paragraph?: { elements?: Array<{ startIndex?: number | null; textRun?: { content?: string } }> };
};

function docPlainText(doc: { body?: { content?: DocElement[] } }): string {
  let out = '';
  for (const el of doc.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      out += run.textRun?.content ?? '';
    }
  }
  return out;
}

async function main() {
  const docArg = process.argv.find((a) => a.startsWith('--doc-id='));
  const documentId = docArg?.split('=')[1]?.trim() || DEFAULT_NYWE_DOC_ID;

  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });
  const { data: doc } = await docs.documents.get({ documentId });
  const plain = docPlainText(doc);

  const exhibitorTitleNeedle = 'Title: {{signer_1_title}}';
  if (!plain.includes(exhibitorTitleNeedle)) {
    if (!plain.includes('{{signer_1_title}}')) {
      console.log('Template already has no signer_1_title token — nothing to do.');
    } else {
      console.log('Could not locate exhibitor title line for deletion; manual edit may be needed.');
    }
    return;
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: { text: exhibitorTitleNeedle, matchCase: true },
            replaceText: '',
          },
        },
      ],
    },
  });

  console.log('Removed exhibitor Title line from NYWE template.');
  console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
