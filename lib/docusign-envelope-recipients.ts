import { eventAutoReleasesToAccounting } from '@/lib/auto-release-accounting';
import { usesSingleSignerEnvelope } from '@/lib/single-signer-envelope';
import type { Event } from '@/types/db';

/** DocuSign routing order 2 for Shanken countersignature. Null when Shanken signature is pre-printed on the PDF. */
export function docusignCountersignerForEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile' | 'shanken_signatory_email' | 'shanken_signatory_name'>,
): { email: string; name: string } | null {
  if (usesSingleSignerEnvelope(event)) return null;

  const email = event.shanken_signatory_email?.trim();
  const name = event.shanken_signatory_name?.trim();
  if (!email || !name) return null;
  return { email, name };
}

export function countersignerRequiredForEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile'>,
): boolean {
  return !usesSingleSignerEnvelope(event);
}

/** Countersigner identity persisted on fully signed contracts when DocuSign has no routing order 2. */
export function eventCountersignerIdentity(
  event: Pick<Event, 'shanken_signatory_email' | 'shanken_signatory_name'>,
  signedAtIso: string,
): { email: string; name: string; signedDateTime: string } | null {
  const email = event.shanken_signatory_email?.trim();
  const name = event.shanken_signatory_name?.trim();
  if (!email || !name) return null;
  return { email, name, signedDateTime: signedAtIso };
}

export function isNyweOrWhiskyfestAutoReleaseEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  return eventAutoReleasesToAccounting(event);
}
