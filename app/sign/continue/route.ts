import { handleExhibitorDocuSignSignRedirect } from '@/lib/exhibitor-docusign-sign-redirect';
import {
  exhibitorSigningCrossPortalRedirectUrl,
  loadExhibitorSigningPortalContext,
} from '@/lib/exhibitor-signing-portal';

export const runtime = 'nodejs';

/** Exhibitor signing redirect — not under /api/ so corporate proxies are less likely to strip tokens. */
async function handle(req: Request): Promise<Response> {
  let contractId = '';
  let token = '';

  if (req.method === 'POST') {
    const form = await req.formData();
    contractId = String(form.get('c') ?? '').trim();
    token = String(form.get('t') ?? '').trim();
  } else {
    const url = new URL(req.url);
    contractId = url.searchParams.get('c')?.trim() ?? '';
    token = url.searchParams.get('t')?.trim() ?? '';
  }

  const portal = contractId ? await loadExhibitorSigningPortalContext(contractId) : null;
  if (portal && contractId && token) {
    const search = `?c=${encodeURIComponent(contractId)}&t=${encodeURIComponent(token)}`;
    const crossPortal = exhibitorSigningCrossPortalRedirectUrl(
      req.headers.get('host'),
      portal.productKey,
      `/sign/continue${search}`,
    );
    if (crossPortal) {
      if (req.method === 'GET') {
        return Response.redirect(crossPortal, 302);
      }
      const safeAction = crossPortal.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Redirecting</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;">
<p>Redirecting to the correct signing portal…</p>
<form id="f" action="${safeAction}" method="POST">
<input type="hidden" name="c" value="${contractId.replace(/"/g, '&quot;')}"/>
<input type="hidden" name="t" value="${token.replace(/"/g, '&quot;')}"/>
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`;
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  return handleExhibitorDocuSignSignRedirect(contractId, token);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
