import { NextResponse } from 'next/server';
import { createExhibitorSigningViewUrl, formatDocuSignErrorForUser } from '@/lib/docusign';
import { verifyDocuSignSigningLinkToken } from '@/lib/docusign-signing-link';
import { personalNudgeReturnUrl } from '@/lib/contract-personal-nudge-email';
import { getSupabaseAdmin } from '@/lib/supabase';
import { portalKindFromHost } from '@/lib/portal-host';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import type { Event } from '@/types/db';

export const runtime = 'nodejs';

/** Public redirect: opens DocuSign signing for the exhibitor (token-protected). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('t')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing signing link token.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id, signer_1_email, signer_1_name, event_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!contract) {
    console.error('[docusign-sign] Contract not found', {
      contract_id: params.id,
      error: contractError,
      url: req.url,
    });
    return htmlPage(
      'Contract not found',
      'This signing link may be incorrect or the contract may no longer be available. Please contact the sender for a new link.',
    );
  }

  console.log('[docusign-sign] Contract found', {
    contract_id: contract.id,
    status: contract.status,
    has_envelope: !!contract.docusign_envelope_id,
    event_id: contract.event_id,
  });

  const signerEmail = contract.signer_1_email?.trim().toLowerCase();
  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!signerEmail || !envelopeId) {
    return NextResponse.json({ error: 'Signing is not available for this contract.' }, { status: 409 });
  }

  if (!verifyDocuSignSigningLinkToken(params.id, signerEmail, token)) {
    return NextResponse.json({ error: 'Invalid or expired signing link.' }, { status: 403 });
  }

  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return htmlPage(
      'Agreement already completed',
      'This agreement has already been signed or is no longer waiting for your signature. You can close this window.',
    );
  }

  if (contract.status === 'partially_signed') {
    return htmlPage(
      'Thank you',
      'Your signature is already on file. You can close this window.',
    );
  }

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle();
  const event = eventRow as Event | null;

  // Detect product_key / host mismatch (for diagnostics only - signing still works)
  // Note: It's valid for staff to send emails from either portal, so cross-portal
  // access is expected and supported. This warning helps diagnose if wrong URLs
  // are being systematically generated (e.g., Wine contracts always getting Whisky URLs).
  const requestHost = req.headers.get('host') || '';
  const portalKind = portalKindFromHost(requestHost);
  const isWineSpectatorContract = event?.product_key === PRODUCT_WINE_SPECTATOR;
  const expectedPortal = isWineSpectatorContract ? 'nywe' : 'whiskyfest';
  
  if (portalKind !== expectedPortal) {
    console.warn('[docusign-sign] Portal/product mismatch detected (signing will still proceed)', {
      contract_id: contract.id,
      event_product_key: event?.product_key,
      request_host: requestHost,
      portal_kind: portalKind,
      expected_portal: expectedPortal,
      note: 'Cross-portal access is supported. This warns if URLs are being systematically generated incorrectly.',
    });
  }

  console.log('[docusign-sign] Creating DocuSign signing view', {
    contract_id: contract.id,
    envelope_id: envelopeId,
    signer_email: signerEmail,
    event_product_key: event?.product_key,
    request_portal: portalKind,
  });

  try {
    const signingUrl = await createExhibitorSigningViewUrl({
      envelopeId,
      signerEmail,
      signerName: contract.signer_1_name?.trim() || signerEmail,
      returnUrl: personalNudgeReturnUrl(event),
      recipientId: '1',
      bypassRateLimitGuard: true,
    });

    console.log('[docusign-sign] Redirecting to DocuSign', {
      contract_id: contract.id,
      signing_url_host: new URL(signingUrl).host,
    });

    return NextResponse.redirect(signingUrl, { status: 302 });
  } catch (err) {
    console.error('[docusign-sign] Failed to create signing view', {
      contract_id: contract.id,
      envelope_id: envelopeId,
      error: err instanceof Error ? err.message : String(err),
    });
    return htmlPage('Unable to open signing', formatDocuSignErrorForUser(err));
  }
}

function htmlPage(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#1a1a1a;">
<h1 style="font-size:1.25rem;">${escapeHtml(title)}</h1>
<p style="line-height:1.5;color:#444;">${escapeHtml(message)}</p>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
