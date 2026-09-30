/**
 * Optional second client signatory.
 *
 * DocuSign: recipient 4 at routing order 1 (parallel with the exhibitor signer, ahead of the
 * Shanken countersigner at routing order 2). Signs remotely from DocuSign's own email.
 * Template: a single `{{signer_2_block}}` token in the Google Doc expands to the whole
 * signature block when a second signer is set, and to nothing when there is none — so
 * contracts without a second signer look exactly as they do today.
 */
import { DOCUSIGN_ANCHORS } from '@/lib/merge-map';

export const SECOND_SIGNER_BLOCK_TOKEN = '{{signer_2_block}}';
export const SECOND_SIGNER_RECIPIENT_ID = '4';

export type SecondSignerFields = {
  signer_2_name?: string | null;
  signer_2_title?: string | null;
  signer_2_email?: string | null;
};

export type SecondSigner = { name: string; email: string; title: string | null };

export function normalizeSecondSignerText(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Null unless both a name and an email are present. */
export function parseSecondSigner(input: SecondSignerFields | null | undefined): SecondSigner | null {
  const email = input?.signer_2_email?.trim();
  const name = input?.signer_2_name?.trim();
  if (!email || !name) return null;
  return { name, email, title: normalizeSecondSignerText(input?.signer_2_title) };
}

/** Validation shared by the create/edit schemas and the four send paths. */
export function secondSignerValidation(params: {
  signer1Email: string | null | undefined;
  signer2: SecondSigner | null;
  cc: { email: string } | null;
  countersignerEmails: Iterable<string>;
}): string | null {
  const s2 = params.signer2;
  if (!s2) return null;
  const email = s2.email.trim().toLowerCase();
  if (email === (params.signer1Email ?? '').trim().toLowerCase()) {
    return 'Second signer email must differ from the exhibitor signer email.';
  }
  if (params.cc && email === params.cc.email.trim().toLowerCase()) {
    return 'Second signer email must differ from the DocuSign CC email.';
  }
  for (const blocked of params.countersignerEmails) {
    if (email === blocked.trim().toLowerCase()) {
      return 'Second signer email must differ from the Shanken countersigner email.';
    }
  }
  return null;
}

const DRAFT_SIG_LINE = '________________________________';
const DRAFT_DATE_LINE = '________________';
const SECOND_SIGNER_HEADING = 'ADDITIONAL AUTHORIZED SIGNATORY';

/**
 * Text that replaces `{{signer_2_block}}`. Newlines become paragraphs in Google Docs; each new
 * paragraph inherits the style of the paragraph holding the token.
 */
export function secondSignerBlockText(
  signer: SecondSigner | null,
  mode: 'draft' | 'docusign',
): string {
  if (!signer) return '';
  const sig = mode === 'draft' ? DRAFT_SIG_LINE : DOCUSIGN_ANCHORS.sig3;
  const date = mode === 'draft' ? DRAFT_DATE_LINE : DOCUSIGN_ANCHORS.date3;
  const lines = [
    SECOND_SIGNER_HEADING,
    `Print Name: ${signer.name}`,
    signer.title ? `Title: ${signer.title}` : null,
    `Signature: ${sig}                                        Date: ${date}`,
  ].filter((l): l is string => Boolean(l));
  return lines.join('\n');
}

/** Merge tokens every product map must emit (unlisted tokens print literally). */
export function secondSignerMergeTokens(
  contract: SecondSignerFields,
  mode: 'draft' | 'docusign',
): Record<string, string> {
  const signer = parseSecondSigner(contract);
  return {
    [SECOND_SIGNER_BLOCK_TOKEN]: secondSignerBlockText(signer, mode),
    '{{signer_2_name}}': signer?.name ?? '',
    '{{signer_2_title}}': signer?.title ?? '',
    '{{sig_anchor_3}}': signer ? (mode === 'draft' ? DRAFT_SIG_LINE : DOCUSIGN_ANCHORS.sig3) : '',
    '{{date_anchor_3}}': signer ? (mode === 'draft' ? DRAFT_DATE_LINE : DOCUSIGN_ANCHORS.date3) : '',
  };
}
