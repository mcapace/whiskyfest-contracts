import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  exhibitorSigningAccentClass,
  exhibitorSigningCrossPortalRedirectUrl,
  loadExhibitorSigningPortalContext,
} from '@/lib/exhibitor-signing-portal';
import { portalKindFromHost, productKeyForPortalKind } from '@/lib/portal-host';
import { workspaceLabelForProduct } from '@/lib/product-email';

export const dynamic = 'force-dynamic';

type SearchParams = { c?: string };

/** Shown after DocuSign redirects back — no staff login required. */
export default async function SigningCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const host = headers().get('host');
  const contractId = searchParams.c?.trim() ?? '';
  const portal = contractId ? await loadExhibitorSigningPortalContext(contractId) : null;

  if (portal && contractId) {
    const crossPortal = exhibitorSigningCrossPortalRedirectUrl(
      host,
      portal.productKey,
      `/signing/complete?c=${encodeURIComponent(contractId)}`,
    );
    if (crossPortal) redirect(crossPortal);
  }

  const fallbackKey = productKeyForPortalKind(portalKindFromHost(host));
  const workspaceLabel = portal?.workspaceLabel ?? workspaceLabelForProduct(fallbackKey);
  const accentClass = portal ? exhibitorSigningAccentClass(portal.productKey) : exhibitorSigningAccentClass(fallbackKey);

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
