#!/usr/bin/env npx tsx
/**
 * Inserts revision + exhibitor notes merge tokens into WhiskyFest Google Doc templates.
 *
 * Usage (from whiskyfest-contracts/):
 *   npx tsx scripts/patch-wf-template-revision-amendments.mts
 *   npx tsx scripts/patch-wf-template-revision-amendments.mts --doc-id=YOUR_DOC_ID
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (base64 JSON) with Docs access to the templates.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import {
  WF_BOOTH_TEMPLATE_DOC_ID,
  WF_REVISION_SECTION_BODY,
  WF_REVISION_SECTION_MARKER,
  WF_SPONSORSHIP_TEMPLATE_DOC_ID,
} from '../lib/wf-template-revision-section.ts';

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

async function patchTemplate(documentId: string, label: string): Promise<void> {
  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });

  const { data: doc } = await docs.documents.get({ documentId });
  const plain = docPlainText(doc);

  if (plain.includes('{{revision_amendments}}') || plain.includes(WF_REVISION_SECTION_MARKER)) {
    console.log(`[${label}] Already contains revision tokens — skipped.`);
    console.log(`  https://docs.google.com/document/d/${documentId}/edit`);
    return;
  }

  const anchors = ['{{sig_anchor_1}}', 'IN WITNESS WHEREOF', 'SIGNATURES', '{{signer_1_name}}'];
  let insertAt: number | null = null;
  for (const anchor of anchors) {
    insertAt = findInsertIndex(doc, anchor);
    if (insertAt != null) break;
  }

  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;
  const sectionText = `\n\n${WF_REVISION_SECTION_MARKER}\n${WF_REVISION_SECTION_BODY}\n\n`;

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
            containsText: { text: WF_REVISION_SECTION_MARKER, matchCase: true },
            replaceText: '',
          },
        },
      ],
    },
  });

  console.log(`[${label}] Inserted revision section before signatures.`);
  console.log(`  https://docs.google.com/document/d/${documentId}/edit`);
}

async function main() {
  const docArg = process.argv.find((a) => a.startsWith('--doc-id='));
  const singleDocId = docArg?.split('=')[1]?.trim();

  if (singleDocId) {
    await patchTemplate(singleDocId, 'custom');
    return;
  }

  await patchTemplate(WF_BOOTH_TEMPLATE_DOC_ID, 'WhiskyFest booth master');
  await patchTemplate(WF_SPONSORSHIP_TEMPLATE_DOC_ID, 'WhiskyFest sponsorship master');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
