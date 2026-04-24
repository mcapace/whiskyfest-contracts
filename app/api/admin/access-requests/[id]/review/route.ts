import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { notifyAccessRequestApproved, notifyAccessRequestRejected } from '@/lib/notifications';
import type { UserRole } from '@/types/db';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    token: z.string().min(1),
    role: z.enum(['admin', 'sales', 'sales_rep', 'viewer']),
    is_events_team: z.boolean().optional(),
    is_accounting: z.boolean().optional(),
    can_impersonate: z.boolean().optional(),
    send_email: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('reject'),
    token: z.string().min(1),
    reason: z.string().max(1000).optional(),
    send_email: z.boolean().optional(),
  }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const adminEmail = getEffectiveUserEmail(gate.session);
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: ar } = await supabase
    .from('access_requests')
    .select('*')
    .eq('id', params.id)
    .eq('approval_token', parsed.data.token)
    .maybeSingle();

  if (!ar || ar.status !== 'pending' || new Date(ar.token_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This approval link is no longer valid' }, { status: 410 });
  }

  const usedToken = randomBytes(32).toString('hex');

  if (parsed.data.action === 'approve') {
    const flags = {
      is_events_team: Boolean(parsed.data.is_events_team),
      is_accounting: Boolean(parsed.data.is_accounting),
      can_impersonate: Boolean(parsed.data.can_impersonate),
    };

    const { error: upsertErr } = await supabase.from('app_users').upsert({
      email: ar.email,
      name: ar.name,
      role: parsed.data.role as UserRole,
      is_active: true,
      ...flags,
    });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    const { error: reqErr } = await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        reviewed_by: adminEmail,
        reviewed_at: new Date().toISOString(),
        review_notes: null,
        granted_role: parsed.data.role,
        granted_flags: flags,
        approval_token: usedToken,
        token_expires_at: new Date().toISOString(),
      })
      .eq('id', ar.id);
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    await supabase.from('audit_log').insert({
      contract_id: null,
      actor_email: adminEmail,
      action: 'access_request_approved',
      metadata: {
        target_email: ar.email,
        granted_role: parsed.data.role,
        granted_flags: flags,
      },
    });

    if (parsed.data.send_email !== false) {
      await notifyAccessRequestApproved(ar.email);
    }
    return NextResponse.json({ ok: true });
  }

  const reason = parsed.data.reason?.trim() || null;
  const { error: rejErr } = await supabase
    .from('access_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
      review_notes: reason,
      granted_role: null,
      granted_flags: null,
      approval_token: usedToken,
      token_expires_at: new Date().toISOString(),
    })
    .eq('id', ar.id);
  if (rejErr) return NextResponse.json({ error: rejErr.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: null,
    actor_email: adminEmail,
    action: 'access_request_rejected',
    metadata: {
      target_email: ar.email,
      reason,
    },
  });

  if (parsed.data.send_email !== false) {
    await notifyAccessRequestRejected(ar.email, reason);
  }
  return NextResponse.json({ ok: true });
}
