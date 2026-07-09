import { NextResponse } from 'next/server';
import {
  createExhibitorSigningViewUrl,
  formatDocuSignErrorForUser,
  resolveExhibitorSigningGate,
} from '@/lib/docusign';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { verifyDocuSignSigningLinkToken } from '@/lib/docusign-signing-link';
import { personalNudgeReturnUrl } from '@/lib/contract-personal-nudge-email';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/** Public redirect: opens DocuSign signing for the exhibitor (token-protected). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('t')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing signing link token.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<ContractWithTotals>();

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

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle();
  const event = (eventRow ?? null) as Event | null;

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

  try {
    const gate = await resolveExhibitorSigningGate(envelopeId, signerEmail, { bypassRateLimitGuard: true });

    if (gate.action === 'already_signed') {
      void syncContractFromDocuSign(supabase, contract, event, null, {
        notify: false,
        forcePoll: true,
      }).catch((err) => console.error('[docusign-sign] sync after already_signed', err));
      return htmlPage(
        'Thank you',
        'Your signature is already on file. You can close this window — no further action is needed.',
      );
    }

    if (gate.action === 'envelope_voided') {
      return htmlPage(
        'Agreement unavailable',
        'This agreement is no longer active in DocuSign. Please contact your event coordinator for a new copy.',
      );
    }

    if (gate.action === 'envelope_declined') {
      return htmlPage(
        'Agreement declined',
        'This agreement was declined in DocuSign. Please contact your event coordinator if you need help.',
      );
    }

    if (gate.action === 'delivery_failed') {
      return htmlPage(
        'Email delivery problem',
        'DocuSign could not deliver to the signer email on this envelope (it may be blocked or invalid). Your event coordinator must correct the email in DocuSign or send a new agreement.',
      );
    }

    if (gate.action === 'no_signature_fields') {
      return htmlPage(
        'Unable to open signing',
        'This DocuSign envelope has no signature fields for the exhibitor. Your event coordinator should use Resend with changes to generate a new agreement.',
      );
    }

    const signingUrl = await createExhibitorSigningViewUrl({
      envelopeId,
      signerEmail: gate.signerEmail,
      signerName: gate.signerName,
      returnUrl: personalNudgeReturnUrl(event),
      recipientId: gate.recipientId,
      bypassRateLimitGuard: true,
    });

    return htmlRedirectPage(signingUrl);
  } catch (err) {
    console.error('[docusign-sign]', err);
    return htmlPage('Unable to open signing', formatDocuSignErrorForUser(err));
  }
}

function htmlRedirectPage(targetUrl: string): NextResponse {
  const safeUrl = escapeHtml(targetUrl);
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="refresh" content="0;url=${safeUrl}"/>
<title>Opening DocuSign</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#1a1a1a;">
<h1 style="font-size:1.25rem;">Opening DocuSign</h1>
<p style="line-height:1.5;color:#444;">If you are not redirected automatically, <a href="${safeUrl}">click here to sign your agreement</a>.</p>
<script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
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
