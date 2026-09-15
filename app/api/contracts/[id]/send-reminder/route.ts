import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { formatDocuSignErrorForUser, resendEnvelopeNotifications } from '@/lib/docusign';
import { sendPersonalContractNudgeEmail } from '@/lib/contract-personal-nudge-email';
import { defaultReminderMessage } from '@/lib/contract-personal-nudge-copy';
import { docuSignSigningRedirectUrl } from '@/lib/docusign-signing-link';
import { insertContractAudit } from '@/lib/audit-log';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Event } from '@/types/db';

export const runtime = 'nodejs';

/**
 * Admin or events team:
 * - `sent`: email exhibitor a portal signing link (same envelope) via SendGrid
 * - `partially_signed`: re-fire DocuSign notifications (countersign queue)
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const contract = await fetchContractWithTotalsById(supabase, params.id);
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Send Reminder is only available while the DocuSign contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }

  const actorEmail = getEffectiveUserEmail(session)?.trim().toLowerCase();
  if (!actorEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Exhibitor already signed — remind countersigners via DocuSign only.
  if (contract.status === 'partially_signed') {
    try {
      await resendEnvelopeNotifications(envelopeId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: formatDocuSignErrorForUser(e) || msg }, { status: 502 });
    }

    await insertContractAudit(supabase, {
      contract_id: params.id,
      actor_email: actorEmail,
      action: 'docusign_send_reminder',
      metadata: {
        envelope_id: envelopeId,
        channel: 'docusign_resend',
        status: contract.status,
      },
    });

    revalidateContractPaths(params.id);
    return NextResponse.json({ ok: true, channel: 'docusign_resend' });
  }

  // status === 'sent' — portal signing-link email (Whisky / Wine / Cigar)
  const signerEmailForToken = contract.signer_1_email?.trim().toLowerCase();
  const signerEmailForDelivery = contract.signer_1_email?.trim();
  if (!signerEmailForToken || !signerEmailForDelivery) {
    return NextResponse.json(
      { error: 'Signer email is required before sending a reminder with a signing link.' },
      { status: 409 },
    );
  }

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle();
  const event = eventRow as Event | null;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const senderName =
    session?.user?.name?.trim() ||
    actorEmail.split('@')[0]?.replace(/\./g, ' ') ||
    'Events team';

  const message = defaultReminderMessage({
    signerName: contract.signer_1_name,
    exhibitorCompanyName: contract.exhibitor_company_name,
    eventName: event.name,
    senderName,
  });

  const signingLandingUrl = docuSignSigningRedirectUrl(contract.id, event, signerEmailForToken);

  try {
    await sendPersonalContractNudgeEmail({
      contractId: contract.id,
      event,
      exhibitorCompanyName: contract.exhibitor_company_name,
      signerName: contract.signer_1_name,
      signerEmail: signerEmailForDelivery,
      personalMessage: message,
      senderName,
      senderEmail: actorEmail,
      signingUrl: signingLandingUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: formatDocuSignErrorForUser(err) || msg }, { status: 502 });
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'docusign_send_reminder',
    metadata: {
      envelope_id: envelopeId,
      channel: 'portal_signing_link',
      status: contract.status,
      signer_email: signerEmailForDelivery,
      product_key: event.product_key,
      signing_url_host: new URL(signingLandingUrl).host,
    },
  });

  revalidateContractPaths(contract.id);

  return NextResponse.json({
    ok: true,
    channel: 'portal_signing_link',
    signingUrl: signingLandingUrl,
  });
}
