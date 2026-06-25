#!/usr/bin/env npx tsx
import { google } from 'googleapis';

const docId = process.argv[2]?.trim() || '1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw';

async function main() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents.readonly'],
  });
  const docs = google.docs({ version: 'v1', auth });
  const { data } = await docs.documents.get({ documentId: docId });
  let plain = '';
  for (const el of data.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      plain += run.textRun?.content ?? '';
    }
  }
  const tokens = [...new Set(plain.match(/\{\{[^}]+\}\}/g) ?? [])].sort();
  console.log('Document:', docId);
  console.log('\nMerge tokens in template:');
  for (const t of tokens) console.log(' ', t);
  console.log('\nHas billing_address_line1:', plain.includes('{{billing_address_line1}}'));
  console.log('Has billing_address (block):', plain.includes('{{billing_address}}'));
  console.log('Has signer_1_title:', plain.includes('{{signer_1_title}}'));
  const titleIdx = plain.search(/Title[^\n]*signer/i);
  if (titleIdx >= 0) console.log('\nTitle line:', JSON.stringify(plain.slice(titleIdx, titleIdx + 80)));
  const billIdx = plain.indexOf('BILLING');
  if (billIdx >= 0) console.log('\nBilling section:\n', plain.slice(billIdx, billIdx + 500));
  else console.log('\nNO BILLING SECTION in doc');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
