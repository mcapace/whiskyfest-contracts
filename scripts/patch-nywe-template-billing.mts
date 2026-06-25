#!/usr/bin/env npx tsx
/**
 * Inserts billing merge tokens into the NYWE vendor license Google Doc template.
 *
 * Usage (from whiskyfest-contracts/):
 *   npx tsx scripts/patch-nywe-template-billing.mts
 *   npx tsx scripts/patch-nywe-template-billing.mts --doc-id=YOUR_DOC_ID
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (base64 JSON) with Docs + Drive access to the template.
 */
import { google } from 'googleapis';
import {
  NYWE_BILLING_SECTION_BODY,
  NYWE_BILLING_SECTION_MARKER,
} from '../lib/nywe-template-billing-section.ts';

const DEFAULT_NYWE_DOC_ID = '1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw';

function getAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
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

function findInsertIndex(doc: { body?: { content?: DocElement[] } }, needle: string): number | null {
  for (const el of doc.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      const text = run.textRun?.content ?? '';
      const idx = text.indexOf(needle);
      if (idx >= 0 && typeof run.startIndex === 'number') {
        return run.startIndex + idx;
      }
    }
  }
  return null;
}

async function main() {
  const docArg = process.argv.find((a) => a.startsWith('--doc-id='));
  const documentId = docArg?.split('=')[1]?.trim() || DEFAULT_NYWE_DOC_ID;

  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });

  const { data: doc } = await docs.documents.get({ documentId });
  const plain = docPlainText(doc);

  if (plain.includes('{{billing_contact_name}}') || plain.includes(NYWE_BILLING_SECTION_MARKER)) {
    console.log('NYWE template already contains billing tokens — no changes made.');
    console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
    return;
  }

  const anchors = ['{{signer_1_name}}', '{{license_fee}}', '{{exhibitor_legal_name}}'];
  let insertAt: number | null = null;
  for (const anchor of anchors) {
    insertAt = findInsertIndex(doc, anchor);
    if (insertAt != null) break;
  }

  const sectionText = `\n\n${NYWE_BILLING_SECTION_MARKER}\n${NYWE_BILLING_SECTION_BODY}\n\n`;
  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: insertAt ?? endIndex - 1 },
            text: sectionText,
          },
        },
        {
          replaceAllText: {
            containsText: { text: NYWE_BILLING_SECTION_MARKER, matchCase: true },
            replaceText: '',
          },
        },
      ],
    },
  });

  console.log('Inserted NYWE billing section into template.');
  console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
