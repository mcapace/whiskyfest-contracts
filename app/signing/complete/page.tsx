import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { docuSignSigningRedirectUrl } from '@/lib/docusign-signing-link';
import {
  exhibitorSigningAccentClass,
  exhibitorSigningCrossPortalRedirectUrl,
  loadExhibitorSigningPortalContext,
} from '@/lib/exhibitor-signing-portal';
import { portalKindFromHost, productKeyForPortalKind } from '@/lib/portal-host';
import { workspaceLabelForProduct } from '@/lib/product-email';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

type SearchParams = { c?: string; event?: string };

/** DocuSign appends `event` to the recipient-view returnUrl. */
function normalizeDocuSignReturnEvent(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

function isSigningSuccessEvent(event: string): boolean {
  return event === 'signing_complete' || event === 'recipient_complete';
}

function isIncompleteSigningEvent(event: string): boolean {
  return (
    event === 'viewing_complete' ||
    event === 'cancel' ||
    event === 'session_timeout' ||
    event === 'ttl_expired' ||
    event === 'exception' ||
    event === 'access_code_failed' ||
    event === 'id_check_failed'
  );
}

/** Shown after DocuSign redirects back — no staff login required. */
export default async function SigningCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const host = headers().get('host');
  const contractId = searchParams.c?.trim() ?? '';
  const docusignEvent = normalizeDocuSignReturnEvent(searchParams.event);
  const portal = contractId ? await loadExhibitorSigningPortalContext(contractId) : null;

  if (portal && contractId) {
    const qs = new URLSearchParams({ c: contractId });
    if (docusignEvent) qs.set('event', docusignEvent);
    const crossPortal = exhibitorSigningCrossPortalRedirectUrl(
      host,
      portal.productKey,
      `/signing/complete?${qs.toString()}`,
    );
    if (crossPortal) redirect(crossPortal);
  }

  const fallbackKey = productKeyForPortalKind(portalKindFromHost(host));
  const workspaceLabel = portal?.workspaceLabel ?? workspaceLabelForProduct(fallbackKey);
  const accentClass = portal
    ? exhibitorSigningAccentClass(portal.productKey)
    : exhibitorSigningAccentClass(fallbackKey);

  let portalStatus: string | null = null;
  let resignUrl: string | null = null;

  if (contractId) {
    try {
      const supabase = getSupabaseAdmin();
      let contract = await fetchContractWithTotalsById(supabase, contractId);
      if (contract) {
        const { data: eventRow } = await supabase
          .from('events')
          .select('*')
          .eq('id', contract.event_id)
          .maybeSingle();
        const event = (eventRow ?? null) as Event | null;

        if (
          isSigningSuccessEvent(docusignEvent) &&
          (contract.status === 'sent' || contract.status === 'partially_signed')
        ) {
          await syncContractFromDocuSign(supabase, contract, event, null, {
            notify: false,
            forcePoll: true,
          });
          contract = (await fetchContractWithTotalsById(supabase, contractId)) ?? contract;
        }

        portalStatus = contract.status;
        const signerEmail = contract.signer_1_email?.trim();
        if (signerEmail && event && contract.status === 'sent') {
          resignUrl = docuSignSigningRedirectUrl(contract.id, event, signerEmail);
        }
      }
    } catch (err) {
      console.error('[signing/complete] post-return sync failed', err);
    }
  }

  const signatureStillPending = portalStatus === 'sent';
  const showIncomplete =
    isIncompleteSigningEvent(docusignEvent) ||
    (isSigningSuccessEvent(docusignEvent) && signatureStillPending) ||
    (!docusignEvent && signatureStillPending && Boolean(resignUrl));

  if (docusignEvent === 'decline') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
        <p className={`inline-flex w-fit rounded px-2 py-1 text-xs font-semibold text-white ${accentClass}`}>
          {workspaceLabel}
        </p>
        <h1 className="mt-4 text-xl font-semibold">Agreement declined</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          You declined this agreement in DocuSign. If that was a mistake, reply to the email from your event
          coordinator.
        </p>
      </main>
    );
  }

  if (showIncomplete) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
        <p className={`inline-flex w-fit rounded px-2 py-1 text-xs font-semibold text-white ${accentClass}`}>
          {workspaceLabel}
        </p>
        <h1 className="mt-4 text-xl font-semibold">Signature not finished</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          DocuSign closed before your signature was completed. Please open the agreement again, click{' '}
          <strong className="font-medium text-foreground">Start</strong> if prompted, apply your signature
          (often on page 2), then click <strong className="font-medium text-foreground">Finish</strong>.
        </p>
        {resignUrl ? (
          <p className="mt-6">
            <a
              href={resignUrl}
              className={`inline-flex rounded px-4 py-2.5 text-sm font-semibold text-white ${accentClass}`}
            >
              Continue signing
            </a>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Use the &quot;Review and sign agreement&quot; button in the email from your event coordinator, or
            reply to that email for a new link.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
      <p className={`inline-flex w-fit rounded px-2 py-1 text-xs font-semibold text-white ${accentClass}`}>
        {workspaceLabel}
      </p>
      <h1 className="mt-4 text-xl font-semibold">Thank you</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Your signature has been submitted. You can close this window. If you have questions about your agreement,
        reply to the email from your event coordinator.
      </p>
    </main>
  );
}
