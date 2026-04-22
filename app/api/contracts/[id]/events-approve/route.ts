import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requiresDiscountApproval } from '@/lib/contracts';
import { notifySalesRepEventsApproved } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract } from '@/types/db';

const schema = z.object({
  reason: z.string().trim().max(1000).optional(),
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
    return NextResponse.json({ error: 'Reason must be at most 1000 characters.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const c = contract as Contract;

  if (c.status !== 'pending_events_review') {
    return NextResponse.json({ error: 'Contract is not pending events review.' }, { status: 400 });
  }

  if (requiresDiscountApproval(c)) {
    return NextResponse.json({ error: 'Discount approval required before events review.' }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() || null;
  const now = new Date().toISOString();
  const email = gate.actor.email;

  const { data: updated, error } = await supabase
    .from('contracts')
    .update({
      status: 'approved',
      approved_at: now,
      events_approved_at: now,
      events_approved_by: email,
      events_approval_reason: reason,
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
    action: 'events_approved',
    from_status: 'pending_events_review',
    to_status: 'approved',
    metadata: {
      approver: email,
      reason,
    },
  });

  revalidateContractPaths(params.id);

  void notifySalesRepEventsApproved(updated as Contract, {
    email,
    name: gate.actor.appUser.name ?? null,
  }).catch((err) => console.error('[notifySalesRepEventsApproved]', err));

  return NextResponse.json({ ok: true, contract: updated });
}
