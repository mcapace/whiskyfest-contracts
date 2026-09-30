#!/usr/bin/env npx tsx
/**
 * Adds the `{{signer_2_block}}` token to the WhiskyFest Google Doc templates (booth + sponsorship),
 * directly under the exhibitor signature line. The portal expands the token to a full
 * "ADDITIONAL AUTHORIZED SIGNATORY" block when a contract has a second signer, and to nothing
 * otherwise, so existing contracts render exactly as before.
 *
 * Usage (from whiskyfest-contracts/):
 *   npx tsx scripts/patch-wf-template-second-signer.mts
 *   npx tsx scripts/patch-wf-template-second-signer.mts --doc-id=YOUR_DOC_ID
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY (base64 JSON) with Docs edit access to the templates.
 */
import { existsSync } from 'node:fs';
import { google } from 'googleapis';

const WF_BOOTH_TEMPLATE_DOC_ID = '1W5wJvMPZUlHfIkZ7yscYBFQrVATzrvwNhHTNrupeQP4';
const WF_SPONSORSHIP_TEMPLATE_DOC_ID = '1rL_IZiTzZyT6dxzz5DYNdI76nrDzrGkDyYpkig1a6Jo';
const SECOND_SIGNER_BLOCK_TOKEN = '{{signer_2_block}}';
/** The exhibitor's own signature/date line — the second-signer block goes right under it. */
const AFTER_ANCHORS = ['{{date_anchor_1}}', '{{sig_anchor_1}}', 'Print Name: {{signer_1_name}}'];

function loadEnvLocal(): void {
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof loader !== 'function') return;
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      loader.call(process, file);
      return;
    }
  }
}

function getAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.readonly'],
  });
}

type DocElement = {
  startIndex?: number | null;
  endIndex?: number | null;
  paragraph?: { elements?: Array<{ textRun?: { content?: string } }> };
};

function paragraphText(el: DocElement): string {
  return (el.paragraph?.elements ?? []).map((r) => r.textRun?.content ?? '').join('');
}

async function patchTemplate(documentId: string, label: string): Promise<void> {
  const docs = google.docs({ version: 'v1', auth: getAuth() });
  const { data: doc } = await docs.documents.get({ documentId });
  const content = (doc.body?.content ?? []) as DocElement[];
  const plain = content.map(paragraphText).join('');

  if (plain.includes(SECOND_SIGNER_BLOCK_TOKEN)) {
    console.log(`[${label}] Already contains ${SECOND_SIGNER_BLOCK_TOKEN} — skipped.`);
    return;
  }

  let anchorParagraph: DocElement | null = null;
  for (const needle of AFTER_ANCHORS) {
    anchorParagraph = content.find((el) => el.paragraph && paragraphText(el).includes(needle)) ?? null;
    if (anchorParagraph) break;
  }
  if (!anchorParagraph || anchorParagraph.endIndex == null) {
    throw new Error(`[${label}] Could not find the exhibitor signature line (${AFTER_ANCHORS.join(' / ')}).`);
  }

  // Insert before the anchor paragraph's trailing newline: "\n" + token becomes a new paragraph
  // directly after it, inheriting its paragraph style.
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: anchorParagraph.endIndex - 1 },
            text: `\n\n${SECOND_SIGNER_BLOCK_TOKEN}`,
          },
        },
      ],
    },
  });

  console.log(`[${label}] Inserted ${SECOND_SIGNER_BLOCK_TOKEN} under the exhibitor signature line.`);
  console.log(`  https://docs.google.com/document/d/${documentId}/edit`);
}

async function main() {
  loadEnvLocal();
  const docArg = process.argv.find((a) => a.startsWith('--doc-id='));
  if (docArg) {
    await patchTemplate(docArg.slice('--doc-id='.length), 'custom');
    return;
  }
  await patchTemplate(WF_BOOTH_TEMPLATE_DOC_ID, 'WhiskyFest booth');
  await patchTemplate(WF_SPONSORSHIP_TEMPLATE_DOC_ID, 'WhiskyFest sponsorship');
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
