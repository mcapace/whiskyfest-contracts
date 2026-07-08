import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import {
  sendPersonalContractNudgeEmail,
} from '@/lib/contract-personal-nudge-email';
import { defaultPersonalNudgeMessage } from '@/lib/contract-personal-nudge-copy';
import { insertContractAudit } from '@/lib/audit-log';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Event } from '@/types/db';

export const runtime = 'nodejs';

const bodySchema = z.object({
  message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(4000),
  internal_cc_email: z.string().email().optional().or(z.literal('')).nullable(),
  internal_cc_name: z.string().max(200).optional().nullable(),
});

/** Staff: send a personal follow-up email to the unsigned exhibitor with a DocuSign signing link. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const access = await assertContractAccess(session, params.id, {
    allowedStatuses: ['sent'],
  });
  if (!access.ok) return access.response;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors[0]?.message : 'Invalid request body';
    return NextResponse.json({ error: msg ?? 'Invalid request body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const contract = await fetchContractWithTotalsById(supabase, params.id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  const signerEmail = contract.signer_1_email?.trim().toLowerCase();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }
  if (!signerEmail) {
    return NextResponse.json({ error: 'Signer email is required before sending a nudge.' }, { status: 409 });
  }

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle();
  const event = eventRow as Event | null;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const actorEmail = getEffectiveUserEmail(session)?.trim().toLowerCase();
  if (!actorEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const senderName =
    session?.user?.name?.trim() ||
    actorEmail.split('@')[0]?.replace(/\./g, ' ') ||
    'Events team';

  const internalCcEmail = body.internal_cc_email?.trim().toLowerCase() || null;
  if (internalCcEmail && internalCcEmail === signerEmail) {
    return NextResponse.json({ error: 'Internal CC must differ from the signer email.' }, { status: 400 });
  }

  const message =
    body.message.trim() ||
    defaultPersonalNudgeMessage({
      signerName: contract.signer_1_name,
      exhibitorCompanyName: contract.exhibitor_company_name,
      eventName: event.name,
      senderName,
    });

  try {
    await sendPersonalContractNudgeEmail({
      contractId: contract.id,
      event,
      exhibitorCompanyName: contract.exhibitor_company_name,
      signerName: contract.signer_1_name,
      signerEmail,
      personalMessage: message,
      senderName,
      senderEmail: actorEmail,
      internalCcEmail,
      internalCcName: body.internal_cc_name?.trim() || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'personal_nudge_sent',
    metadata: {
      signer_email: signerEmail,
      internal_cc_email: internalCcEmail,
      message_preview: message.slice(0, 240),
    },
  });

  revalidateContractPaths(contract.id);

  return NextResponse.json({ ok: true });
}
