#!/usr/bin/env npx tsx
/**
 * Insert merge tokens into the Big Smoke Las Vegas master Google Doc.
 *
 * Replaces blank underscore fields with {{tokens}} matching buildBigSmokeMergeMap,
 * and adds package fee + notes/revision sections when missing.
 *
 * Usage (from whiskyfest-contracts/):
 *   npx tsx scripts/patch-big-smoke-template.mts
 *   npx tsx scripts/patch-big-smoke-template.mts --doc-id=YOUR_DOC_ID
 *   npx tsx scripts/patch-big-smoke-template.mts --dry-run
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

/** Exact find → replace pairs (order matters for overlapping underscores). */
const REPLACEMENTS: Array<{ find: string; replace: string }> = [
  // Opening agreement line
  {
    find: 'AGREEMENT made this ____ day of ____________, _____, between _____________________, hereinafter called the Festival Sponsor',
    replace:
      'AGREEMENT made this {{agreement_day}} day of {{agreement_month}}, {{agreement_year}}, between {{exhibitor_legal_name}}, hereinafter called the Festival Sponsor',
  },
  // Festival sponsor signature block (company / address / contact)
  { find: 'Company Name ______________', replace: 'Company Name {{exhibitor_company_name}}' },
  { find: 'Address ____________________', replace: 'Address {{exhibitor_address_line1}}' },
  { find: '___________________________', replace: '{{exhibitor_city}}, {{exhibitor_state}} {{exhibitor_zip}}' },
  { find: 'Telephone ___________________', replace: 'Telephone {{exhibitor_telephone}}' },
  { find: 'Email ______________________', replace: 'Email {{event_contact_email}}' },
  { find: 'Print Name _________________', replace: 'Print Name {{signer_1_name}}' },
  { find: 'Title _______________________', replace: 'Title {{signer_1_title}}' },
  // Signature line — try a few spacing variants
  {
    find: 'Signature ___________________',
    replace: 'Signature {{sig_anchor_1}}',
  },
  {
    find: ' Date __________ Signature______________ Date __________',
    replace: ' Date {{date_anchor_1}} Signature {{sig_anchor_2}} Date {{date_anchor_2}}',
  },
];

const PACKAGE_FEE_MARKER = '{{package_fee}}';
const PACKAGE_FEE_LINE =
  'PACKAGE FEE: ${{package_fee}}  |  Booth count: {{booth_count}}  |  Event: {{event_name}} ({{event_date}}) at {{event_venue}}\n';

const NOTES_MARKER = '{{exhibitor_notes}}';
const NOTES_BLOCK =
  '\nEXHIBITOR NOTES\n{{exhibitor_notes}}\n\nREVISION AMENDMENTS\n{{revision_amendments}}\n';

async function main() {
  const docArg = process.argv.find((a) => a.startsWith('--doc-id='));
  const dryRun = process.argv.includes('--dry-run');
  const documentId = docArg?.split('=')[1]?.trim() || BIG_SMOKE_TEMPLATE_DOC_ID;

  const auth = getAuth();
  const docs = google.docs({ version: 'v1', auth });

  const { data: doc } = await docs.documents.get({ documentId });
  let plain = docPlainText(doc);
  console.log(`Doc: https://docs.google.com/document/d/${documentId}/edit`);
  console.log(`Title: ${doc.title}`);
  console.log(`Chars: ${plain.length}`);

  type ReqReq = { replaceAllText?: { containsText: { text: string; matchCase: boolean }; replaceText: string } };
  const requests: ReqReq[] = [];
  const planned: string[] = [];

  for (const { find, replace } of REPLACEMENTS) {
    if (!plain.includes(find)) {
      if (plain.includes(replace) || replace.split('{{').some((p) => p.includes('}}') && plain.includes(`{{${p.split('}}')[0]}}`))) {
        console.log(`skip (already tokenized): ${find.slice(0, 48)}…`);
      } else {
        console.warn(`WARN missing find text: ${JSON.stringify(find.slice(0, 80))}…`);
      }
      continue;
    }
    planned.push(`${find.slice(0, 40)}… → ${replace.slice(0, 60)}…`);
    requests.push({
      replaceAllText: {
        containsText: { text: find, matchCase: true },
        replaceText: replace,
      },
    });
  }

  // Package fee line after PAYMENT TERMS if not present
  if (!plain.includes(PACKAGE_FEE_MARKER)) {
    const afterPayment = findInsertIndex(doc, 'PAYMENT TERMS:');
    if (afterPayment != null) {
      // Insert after the PAYMENT TERMS sentence — find end of that paragraph by newline after.
      const idxInPlain = plain.indexOf('PAYMENT TERMS:');
      const nl = plain.indexOf('\n', idxInPlain);
      const insertAt =
        nl >= 0
          ? // approximate: need index in doc — search for "CONDITIONS:"
            findInsertIndex(doc, 'CONDITIONS:')
          : findInsertIndex(doc, 'CONDITIONS:');
      if (insertAt != null) {
        planned.push(`insert package fee before CONDITIONS`);
        (requests as unknown as Array<Record<string, unknown>>).push({
          insertText: {
            location: { index: insertAt },
            text: PACKAGE_FEE_LINE,
          },
        });
      } else {
        console.warn('WARN could not find CONDITIONS: for package fee insert');
      }
    } else {
      console.warn('WARN could not find PAYMENT TERMS: for package fee insert');
    }
  } else {
    console.log('skip package fee (already present)');
  }

  // Notes / revisions before INSURANCE REQUIREMENTS
  if (!plain.includes(NOTES_MARKER)) {
    const insertAt =
      findInsertIndex(doc, 'INSURANCE REQUIREMENTS') ??
      findInsertIndex(doc, 'BOOTH PLACEMENT AND SEMINAR');
    if (insertAt != null) {
      planned.push('insert exhibitor notes + revision amendments');
      (requests as unknown as Array<Record<string, unknown>>).push({
        insertText: {
          location: { index: insertAt },
          text: NOTES_BLOCK,
        },
      });
    } else {
      console.warn('WARN could not find insert point for notes/revisions');
    }
  } else {
    console.log('skip notes (already present)');
  }

  console.log(`\nPlanned changes (${planned.length}):`);
  for (const p of planned) console.log(' -', p);

  if (requests.length === 0) {
    console.log('\nNo Doc changes needed.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: not writing to Google Doc');
    return;
  }

  // Google Docs: process inserts carefully — replaceAll first, then re-fetch for inserts
  const replaceOnly = requests.filter((r) => r.replaceAllText);
  if (replaceOnly.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: replaceOnly },
    });
    console.log(`Applied ${replaceOnly.length} replaceAllText ops`);
  }

  // Re-fetch for insert indexes after replacements
  const { data: doc2 } = await docs.documents.get({ documentId });
  plain = docPlainText(doc2);
  const insertRequests: Array<Record<string, unknown>> = [];

  if (!plain.includes(PACKAGE_FEE_MARKER)) {
    const insertAt = findInsertIndex(doc2, 'CONDITIONS:');
    if (insertAt != null) {
      insertRequests.push({
        insertText: { location: { index: insertAt }, text: PACKAGE_FEE_LINE },
      });
    }
  }

  if (!plain.includes(NOTES_MARKER)) {
    const insertAt =
      findInsertIndex(doc2, 'INSURANCE REQUIREMENTS') ??
      findInsertIndex(doc2, 'BOOTH PLACEMENT AND SEMINAR');
    if (insertAt != null) {
      insertRequests.push({
        insertText: { location: { index: insertAt }, text: NOTES_BLOCK },
      });
    }
  }

  if (insertRequests.length > 0) {
    // Apply from end to start so indexes stay valid
    insertRequests.sort((a, b) => {
      const ia = (a.insertText as { location: { index: number } }).location.index;
      const ib = (b.insertText as { location: { index: number } }).location.index;
      return ib - ia;
    });
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: insertRequests },
    });
    console.log(`Applied ${insertRequests.length} insertText ops`);
  }

  const { data: finalDoc } = await docs.documents.get({ documentId });
  const finalPlain = docPlainText(finalDoc);
  const tokens = [...new Set(finalPlain.match(/\{\{[^}]+\}\}/g) ?? [])].sort();
  console.log('\nMerge tokens now in template:');
  for (const t of tokens) console.log(' ', t);
  console.log(`\nDone. https://docs.google.com/document/d/${documentId}/edit`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
