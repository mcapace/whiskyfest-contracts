import { eventAutoReleasesToAccounting } from '@/lib/auto-release-accounting';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { resolveWfBsCountersignSigningGroupId, WF_BS_COUNTERSIGN_GROUP_LABEL, wfBsSigningGroupSetupInstructions } from '@/lib/docusign-signing-groups';
import { usesSingleSignerEnvelope } from '@/lib/single-signer-envelope';
import { WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS } from '@/lib/wf-bslv-countersigner';
import type { Event } from '@/types/db';

export type DocuSignCountersignDelivery =
  | { mode: 'user'; email: string; name: string }
  | { mode: 'signing_group'; signingGroupId: string; displayName: string };

/** DocuSign routing order 2 for Shanken countersignature. Null only if the event has no signatory. */
export function docusignCountersignerForEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile' | 'shanken_signatory_email' | 'shanken_signatory_name'>,
): { email: string; name: string } | null {
  if (usesSingleSignerEnvelope(event)) return null;

  const email = event.shanken_signatory_email?.trim();
  const name = event.shanken_signatory_name?.trim();
  if (!email || !name) return null;
  return { email, name };
}

/** Liz / Nicole / Tobi signing group — WhiskyFest and Big Smoke only. NYWE routes to Susannah. */
function usesWfBsCountersignSigningGroup(
  event: Pick<Event, 'product_key' | 'workflow_profile'>,
): boolean {
  return !isNyweEventsManagedEvent(event);
}

/** Resolve routing order 2 — WF/BSLV use a DocuSign signing group when configured (Liz / Nicole / Tobi). */
export async function resolveDocuSignCountersignDelivery(
  event: Pick<Event, 'product_key' | 'workflow_profile' | 'shanken_signatory_email' | 'shanken_signatory_name'>,
): Promise<DocuSignCountersignDelivery | null> {
  if (usesSingleSignerEnvelope(event)) return null;

  if (usesWfBsCountersignSigningGroup(event)) {
    const signingGroupId = resolveWfBsCountersignSigningGroupId();
    if (signingGroupId) {
      return {
        mode: 'signing_group',
        signingGroupId,
        displayName: WF_BS_COUNTERSIGN_GROUP_LABEL,
      };
    }
    console.warn(`[docusign-envelope-recipients] ${wfBsSigningGroupSetupInstructions()}`);
  }

  const email = event.shanken_signatory_email?.trim();
  const name = event.shanken_signatory_name?.trim();
  if (!email || !name) return null;
  return { mode: 'user', email, name };
}

export function countersignCcValidation(params: {
  signerEmail: string;
  delivery: DocuSignCountersignDelivery | null;
  cc: { email: string } | null;
}): string | null {
  if (!params.cc) return null;
  const cc = params.cc.email.trim().toLowerCase();
  if (cc === params.signerEmail.trim().toLowerCase()) {
    return 'CC email must differ from the exhibitor signer email.';
  }
  const blocked = new Set<string>(
    params.delivery?.mode === 'user'
      ? [params.delivery.email.trim().toLowerCase()]
      : [...WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS],
  );
  if (blocked.has(cc)) {
    return 'CC email must differ from the Shanken countersigner email.';
  }
  return null;
}

export function toSendEnvelopeCountersignParams(delivery: DocuSignCountersignDelivery | null): {
  countersigner?: { email: string; name: string } | null;
  countersignerSigningGroupId?: string | null;
} {
  if (!delivery) return { countersigner: null };
  if (delivery.mode === 'signing_group') {
    return { countersignerSigningGroupId: delivery.signingGroupId };
  }
  return { countersigner: { email: delivery.email, name: delivery.name } };
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
