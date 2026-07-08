import { NextResponse } from 'next/server';
import { createExhibitorSigningViewUrl, fetchEnvelopeSigners } from '@/lib/docusign';
import { verifyDocuSignSigningLinkToken } from '@/lib/docusign-signing-link';
import { personalNudgeReturnUrl } from '@/lib/contract-personal-nudge-email';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

export const runtime = 'nodejs';

/** Public redirect: opens DocuSign signing for the exhibitor (token-protected). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('t')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing signing link token.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id, signer_1_email, signer_1_name, event_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
  }

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

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle();
  const event = eventRow as Event | null;

  try {
    const signers = await fetchEnvelopeSigners(envelopeId);
    const exhibitor = signers.find((s) => s.routingOrder === '1');
    const exhibitorStatus = exhibitor?.status?.toLowerCase() ?? '';
    if (exhibitorStatus === 'completed' || exhibitorStatus === 'signed') {
      return htmlPage(
        'Thank you',
        'Your signature is already on file. You can close this window.',
      );
    }

    const signingUrl = await createExhibitorSigningViewUrl({
      envelopeId,
      signerEmail,
      signerName: contract.signer_1_name?.trim() || signerEmail,
      returnUrl: personalNudgeReturnUrl(event),
    });

    return NextResponse.redirect(signingUrl, { status: 302 });
  } catch (err) {
    console.error('[docusign-sign]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return htmlPage('Unable to open signing', msg);
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
