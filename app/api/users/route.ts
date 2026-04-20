import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/types/db';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'sales', 'viewer']),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('app_users').select('*').order('email', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const actorEmail = gate.session.user.email?.toLowerCase();
  if (!actorEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetEmail = parsed.data.email.toLowerCase();
  if (targetEmail === actorEmail && parsed.data.role !== 'admin') {
    return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 });
  }
  if (targetEmail === actorEmail && parsed.data.is_active === false) {
    return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const update: { role: UserRole; is_active?: boolean } = { role: parsed.data.role as UserRole };
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data, error } = await supabase.from('app_users').update(update).eq('email', targetEmail).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
