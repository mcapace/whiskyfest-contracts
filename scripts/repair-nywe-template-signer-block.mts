#!/usr/bin/env npx tsx
/** Repair NYWE template after partial title-line deletion. */
import { google } from 'googleapis';

const docId = process.argv[2]?.trim() || '1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw';

async function main() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents'],
  });
  const docs = google.docs({ version: 'v1', auth });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: { text: 'er_1_title}}', matchCase: true },
            replaceText: '',
          },
        },
      ],
    },
  });

  const { data } = await docs.documents.get({ documentId: docId });
  let plain = '';
  for (const el of data.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      plain += run.textRun?.content ?? '';
    }
  }
  const sigIdx = plain.indexOf('{{signer_1_name}}');
  console.log('Signature block:', JSON.stringify(plain.slice(sigIdx, sigIdx + 120)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
