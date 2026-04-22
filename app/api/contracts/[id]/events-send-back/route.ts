import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifySalesRepContractSentBack } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract } from '@/types/db';

const schema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.appUser.is_events_team) {
    return NextResponse.json({ error: 'Events team access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A non-empty reason (at least 10 characters) is required.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const c = contract as Contract;

  if (c.status !== 'pending_events_review') {
    return NextResponse.json({ error: 'Contract is not pending events review.' }, { status: 400 });
  }

  const reason = parsed.data.reason.trim();
  const now = new Date().toISOString();
  const email = gate.actor.email;

  const { data: updated, error } = await supabase
    .from('contracts')
    .update({
      status: 'draft',
      events_sent_back_at: now,
      events_sent_back_by: email,
      events_sent_back_reason: reason,
      events_submitted_at: null,
      events_approved_at: null,
      events_approved_by: null,
      events_approval_reason: null,
    })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: email,
    action: 'events_sent_back',
    from_status: 'pending_events_review',
    to_status: 'draft',
    metadata: {
      sender: email,
      reason,
    },
  });

  revalidateContractPaths(params.id);

  void notifySalesRepContractSentBack(updated as Contract, { email, name: gate.actor.appUser.name ?? null }, reason).catch(
    (err) => console.error('[notifySalesRepContractSentBack]', err),
  );

  return NextResponse.json({ ok: true, contract: updated });
}
