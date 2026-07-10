#!/usr/bin/env npx tsx
/**
 * Inserts revision + exhibitor notes merge tokens into the NYWE vendor license Google Doc template.
 *
 * Usage (from whiskyfest-contracts/):
 *   npx tsx scripts/patch-nywe-template-revision-amendments.mts
 *   npx tsx scripts/patch-nywe-template-revision-amendments.mts --doc-id=YOUR_DOC_ID
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (base64 JSON) with Docs access to the template.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import {
  NYWE_REVISION_SECTION_BODY,
  NYWE_REVISION_SECTION_MARKER,
  NYWE_TEMPLATE_DOC_ID,
} from '../lib/nywe-template-revision-section.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  console.warn('No .env.local — using process env only');
}

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
  const documentId = docArg?.split('=')[1]?.trim() || NYWE_TEMPLATE_DOC_ID;

  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });

  const { data: doc } = await docs.documents.get({ documentId });
  const plain = docPlainText(doc);

  if (plain.includes('{{revision_amendments}}') || plain.includes(NYWE_REVISION_SECTION_MARKER)) {
    console.log('NYWE template already contains revision tokens — no changes made.');
    console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
    return;
  }

  const anchors = ['{{sig_anchor_1}}', 'IN WITNESS WHEREOF', 'SIGNATURES', '{{signer_1_name}}'];
  let insertAt: number | null = null;
  for (const anchor of anchors) {
    insertAt = findInsertIndex(doc, anchor);
    if (insertAt != null) break;
  }

  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;
  const sectionText = `\n\n${NYWE_REVISION_SECTION_MARKER}\n${NYWE_REVISION_SECTION_BODY}\n\n`;

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
            containsText: { text: NYWE_REVISION_SECTION_MARKER, matchCase: true },
            replaceText: '',
          },
        },
      ],
    },
  });

  console.log('Inserted NYWE revision section into template.');
  console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
