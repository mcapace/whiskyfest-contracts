import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getLoginUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(10).optional(),
  reason: z.string().max(500).optional(),
});

/**
 * Admin-only: mark bubble removed for all users.
 * If `token` is sent, it must match the row and still be valid (email flow).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const { id } = params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid bubble id' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: fetchErr } = await supabase.from('daily_bubbles').select('*').eq('id', id).maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.removed_at) {
    return NextResponse.json({ error: 'Already removed' }, { status: 409 });
  }

  if (parsed.data.token) {
    const now = new Date().toISOString();
    if (row.remove_token !== parsed.data.token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }
    if (!row.remove_token_expires_at || row.remove_token_expires_at < now) {
      return NextResponse.json({ error: 'Token expired' }, { status: 403 });
    }
  }

  const actor = getLoginUserEmail(gate.session)!;
  const nowIso = new Date().toISOString();

  const { error: upErr } = await supabase
    .from('daily_bubbles')
    .update({
      removed_at: nowIso,
      removed_by: actor,
      removed_reason: parsed.data.reason?.trim() || null,
      remove_token: null,
      remove_token_expires_at: null,
    })
    .eq('id', id);

  if (upErr) {
    console.error('[admin/bubbles/remove]', upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: auditErr } = await supabase.from('audit_log').insert({
    contract_id: null,
    actor_email: actor,
    action: 'bubble_removed',
    from_status: null,
    to_status: null,
    metadata: { bubble_id: id },
  });

  if (auditErr) {
    console.error('[admin/bubbles/remove] audit_log insert:', auditErr);
  }

  return NextResponse.json({ ok: true });
}
