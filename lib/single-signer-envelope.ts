import type { Event } from '@/types/db';

/**
 * All live products use dual-signer DocuSign: exhibitor (routing 1), then Shanken countersignature (routing 2).
 * NYWE previously pre-printed `/s/ {signatory}` and skipped routing 2 — that left custom PDFs unsigned
 * and legal copies without a Wine Spectator signature. Keep this helper so call sites stay explicit.
 */
export function usesSingleSignerEnvelope(
  _event?: Pick<Event, 'product_key' | 'workflow_profile'> | null,
): boolean {
  return false;
}

/** @deprecated Use usesSingleSignerEnvelope */
export const nyweUsesSingleSignerEnvelope = usesSingleSignerEnvelope;
