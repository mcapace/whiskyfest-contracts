import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import type { Event } from '@/types/db';

/**
 * One DocuSign signer (exhibitor/winery). Shanken countersignature is pre-printed on the PDF.
 * WhiskyFest and Big Smoke use dual-signer DocuSign (Liz / Nicole / Tobi routing order 2) — not this path.
 * NYWE remains single-signer.
 */
export function usesSingleSignerEnvelope(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  if (!event) return false;
  return isNyweEventsManagedEvent(event);
}

/** @deprecated Use usesSingleSignerEnvelope */
export const nyweUsesSingleSignerEnvelope = usesSingleSignerEnvelope;
