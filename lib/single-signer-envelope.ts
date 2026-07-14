import { isBigSmokeEventsManagedEvent, isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { PRODUCT_WHISKYFEST } from '@/lib/product-portal';
import type { Event } from '@/types/db';

/**
 * One DocuSign signer (exhibitor/winery). Shanken countersignature is pre-printed on the PDF.
 */
export function usesSingleSignerEnvelope(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  if (!event) return false;
  return (
    event.product_key === PRODUCT_WHISKYFEST ||
    isNyweEventsManagedEvent(event) ||
    isBigSmokeEventsManagedEvent(event)
  );
}

/** @deprecated Use usesSingleSignerEnvelope */
export const nyweUsesSingleSignerEnvelope = usesSingleSignerEnvelope;
