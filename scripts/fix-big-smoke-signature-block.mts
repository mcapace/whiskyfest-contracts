#!/usr/bin/env npx tsx
/**
 * Reformat the Big Smoke Google Doc Festival Sponsor signature block so
 * DocuSign Sign/Date tabs are not piled onto one mid-page line.
 *
 * Usage:
 *   npx tsx scripts/fix-big-smoke-signature-block.mts
 *   npx tsx scripts/fix-big-smoke-signature-block.mts --dry-run
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { BIG_SMOKE_TEMPLATE_DOC_ID } from '../lib/big-smoke-template.ts';

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
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function docPlainText(doc: {
  body?: {
    content?: Array<{
      paragraph?: { elements?: Array<{ textRun?: { content?: string } }> };
    }>;
  };
}): string {
  let out = '';
  for (const el of doc.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      out += run.textRun?.content ?? '';
    }
  }
  return out;
}

/** Current jammed signature line (date_anchor_1 sits between columns). */
const OLD_SIG_LINE =
  'Signature {{sig_anchor_1}}\t\t Date {{date_anchor_1}} Signature {{sig_anchor_2}} Date {{date_anchor_2}}';

/**
 * Side-by-side sign/date without stacking Date onto the center of the page.
 * Left = exhibitor; right = Shanken (printed /s/ + date in single-signer mode).
 */
const NEW_SIG_BLOCK = [
  'Signature {{sig_anchor_1}}\t\tSignature {{sig_anchor_2}}',
  'Date {{date_anchor_1}}\t\tDate {{date_anchor_2}}',
].join('\n');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const documentId =
    process.argv.find((a) => a.startsWith('--doc-id='))?.split('=')[1]?.trim() ||
    BIG_SMOKE_TEMPLATE_DOC_ID;

  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });
  const { data: doc } = await docs.documents.get({ documentId });
  const plain = docPlainText(doc);

  console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
  console.log(`Title: ${doc.title}`);

  if (plain.includes(NEW_SIG_BLOCK) || plain.includes('Signature {{sig_anchor_1}}\t\tSignature {{sig_anchor_2}}')) {
    console.log('Signature block already looks reformatted — nothing to do.');
    return;
  }

  if (!plain.includes(OLD_SIG_LINE) && !plain.includes('Date {{date_anchor_1}} Signature {{sig_anchor_2}}')) {
    console.warn('Could not find the jammed signature line. Dumping Festival Sponsor region:');
    const idx = plain.indexOf('FESTIVAL SPONSOR\nCompany Name');
    console.log(JSON.stringify(plain.slice(idx, idx + 700)));
    process.exit(1);
  }

  const findText = plain.includes(OLD_SIG_LINE)
    ? OLD_SIG_LINE
    : // Fallback: match without relying on exact tab characters
      (() => {
        const start = plain.indexOf('Signature {{sig_anchor_1}}');
        const end = plain.indexOf('{{date_anchor_2}}', start) + '{{date_anchor_2}}'.length;
        return plain.slice(start, end);
      })();

  console.log('Replacing jammed signature line with stacked Sign/Date columns.');
  console.log('FROM:', JSON.stringify(findText));
  console.log('TO:  ', JSON.stringify(NEW_SIG_BLOCK));

  if (dryRun) {
    console.log('--dry-run: not writing');
    return;
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: { text: findText, matchCase: true },
            replaceText: NEW_SIG_BLOCK,
          },
        },
      ],
    },
  });

  const { data: after } = await docs.documents.get({ documentId });
  const afterPlain = docPlainText(after);
  const idx = afterPlain.indexOf('FESTIVAL SPONSOR\nCompany Name');
  console.log('\nUpdated Festival Sponsor region:');
  console.log(afterPlain.slice(idx, idx + 650));
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
