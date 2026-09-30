import { fetchGoogleDocPlainText } from '@/lib/google-doc-plain-text';
import { SECOND_SIGNER_BLOCK_TOKEN } from '@/lib/second-signer';

const checkedTemplates = new Map<string, { ok: boolean; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

/**
 * A second signer needs the `{{signer_2_block}}` token in the master Google Doc, otherwise
 * DocuSign rejects the envelope because the \s3\ anchor is missing from the PDF.
 * Returns an error message for the sender, or null when the template is ready.
 */
export async function secondSignerTemplateError(templateDocId: string): Promise<string | null> {
  const cached = checkedTemplates.get(templateDocId);
  if (cached && cached.ok && Date.now() - cached.at < CACHE_MS) return null;

  let ok = false;
  try {
    const text = await fetchGoogleDocPlainText(templateDocId);
    ok = text.includes(SECOND_SIGNER_BLOCK_TOKEN);
  } catch (err) {
    console.warn('[second-signer] template check failed', templateDocId, err instanceof Error ? err.message : err);
    // Cannot verify — let DocuSign be the judge rather than blocking the send.
    return null;
  }
  checkedTemplates.set(templateDocId, { ok, at: Date.now() });
  if (ok) return null;
  return (
    'This contract has a second signer, but the master template has no second-signature block yet. ' +
    'Run `npx tsx scripts/patch-wf-template-second-signer.mts` (adds {{signer_2_block}} to the template), ' +
    'or clear the second signer and send again.'
  );
}
