import { handleExhibitorDocuSignSignRedirect } from '@/lib/exhibitor-docusign-sign-redirect';
import {
  exhibitorSigningCrossPortalRedirectUrl,
  loadExhibitorSigningPortalContext,
} from '@/lib/exhibitor-signing-portal';

export const runtime = 'nodejs';

/** Legacy/direct signing redirect — prefer /sign/continue from the landing page. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('t')?.trim() ?? '';
  const portal = await loadExhibitorSigningPortalContext(params.id);
  if (portal && token) {
    const search = `?c=${encodeURIComponent(params.id)}&t=${encodeURIComponent(token)}`;
    const crossPortal = exhibitorSigningCrossPortalRedirectUrl(
      req.headers.get('host'),
      portal.productKey,
      `/sign/continue${search}`,
    );
    if (crossPortal) {
      return Response.redirect(crossPortal, 302);
    }
  }

  return handleExhibitorDocuSignSignRedirect(params.id, token);
}
