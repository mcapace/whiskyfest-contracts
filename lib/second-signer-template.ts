import { google, type docs_v1 } from 'googleapis';
import { SECOND_SIGNER_BLOCK_TOKEN } from '@/lib/second-signer';

/**
 * Makes sure a master Google Doc template carries `{{signer_2_block}}` directly under the exhibitor
 * signature line. Idempotent: a template that already has the token is left untouched, so the portal
 * can call this right before sending a two-signer contract instead of anyone editing the master by hand.
 */
const AFTER_ANCHORS = ['{{date_anchor_1}}', '{{sig_anchor_1}}', 'Print Name: {{signer_1_name}}', '{{signer_1_name}}'];

export type EnsureSecondSignerBlockResult =
  | { status: 'present' }
  | { status: 'inserted'; afterAnchor: string }
  | { status: 'anchor_not_found' }
  | { status: 'error'; message: string };

function getDocsClient() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'],
  });
  return google.docs({ version: 'v1', auth });
}

function paragraphText(el: docs_v1.Schema$StructuralElement): string {
  return (el.paragraph?.elements ?? []).map((r) => r.textRun?.content ?? '').join('');
}

export async function ensureSecondSignerBlockInTemplate(
  templateDocId: string,
): Promise<EnsureSecondSignerBlockResult> {
  try {
    const docs = getDocsClient();
    const { data: doc } = await docs.documents.get({ documentId: templateDocId });
    const content = doc.body?.content ?? [];
    const plain = content.map(paragraphText).join('');
    if (plain.includes(SECOND_SIGNER_BLOCK_TOKEN)) return { status: 'present' };

    let anchorParagraph: docs_v1.Schema$StructuralElement | undefined;
    let afterAnchor = '';
    for (const needle of AFTER_ANCHORS) {
      anchorParagraph = content.find((el) => el.paragraph && paragraphText(el).includes(needle));
      if (anchorParagraph) {
        afterAnchor = needle;
        break;
      }
    }
    if (!anchorParagraph || anchorParagraph.endIndex == null) return { status: 'anchor_not_found' };

    // "\n\n{{token}}" before the anchor paragraph's trailing newline → a blank line plus the token as
    // its own paragraph directly under the exhibitor signature, inheriting that paragraph's style.
    await docs.documents.batchUpdate({
      documentId: templateDocId,
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
    console.info('[second-signer] inserted template block', { templateDocId, afterAnchor });
    return { status: 'inserted', afterAnchor };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
