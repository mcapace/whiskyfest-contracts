import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { nyweClientSendContract } from '@/lib/nywe-client-send';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import type { Event } from '@/types/db';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** NYWE roster bulk send — auto-approves and emails DocuSign (no per-license review). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();

  const { data: contractRow } = await supabase
    .from('contracts')
    .select('event_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!contractRow) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contractRow.event_id)
    .single<Event>();

  if (!event || !isNyweEventsManagedEvent(event)) {
    return NextResponse.json({ error: 'Not an NYWE roster license.' }, { status: 403 });
  }

  const access = await assertContractAccess(await auth(), params.id);
  if (!access.ok) return access.response;

  if (!access.actor.isEventsTeam && !access.actor.isAdmin) {
    return NextResponse.json({ error: 'Events team access required.' }, { status: 403 });
  }

  const result = await nyweClientSendContract({
    supabase,
    contractId: params.id,
    actorEmail: access.actor.email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode ?? 500 });
  }

  return NextResponse.json({
    ok: true,
    envelope_id: result.envelopeId,
    exhibitor_signer_email: result.exhibitorSignerEmail,
  });
}
