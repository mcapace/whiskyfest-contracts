import { ensureSecondSignerBlockInTemplate } from '@/lib/second-signer-template';

const readyTemplates = new Map<string, number>();
const CACHE_MS = 10 * 60 * 1000;

/**
 * A second signer needs the `{{signer_2_block}}` token in the master Google Doc, otherwise DocuSign
 * rejects the envelope because the \s3\ anchor is missing from the PDF. The portal inserts the token
 * itself (idempotent) the first time a two-signer contract is sent from a template that lacks it.
 * Returns an error message for the sender only when that is impossible.
 */
export async function secondSignerTemplateError(templateDocId: string): Promise<string | null> {
  const readyAt = readyTemplates.get(templateDocId);
  if (readyAt && Date.now() - readyAt < CACHE_MS) return null;

  const result = await ensureSecondSignerBlockInTemplate(templateDocId);
  switch (result.status) {
    case 'present':
    case 'inserted':
      readyTemplates.set(templateDocId, Date.now());
      return null;
    case 'anchor_not_found':
      return (
        'This contract has a second signer, but the master template has no exhibitor signature line the ' +
        'portal can anchor to. Paste {{signer_2_block}} on its own line under the exhibitor "Signature … Date" ' +
        'line of the master Google Doc, or clear the second signer and send again.'
      );
    case 'error':
      console.warn('[second-signer] template check failed', templateDocId, result.message);
      // Cannot verify or patch — let DocuSign be the judge rather than blocking the send.
      return null;
  }
}
