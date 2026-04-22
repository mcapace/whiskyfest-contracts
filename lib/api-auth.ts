import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Session } from 'next-auth';

export async function requireAuth(): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, session };
}

export async function requireAdmin(): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const r = await requireAuth();
  if (!r.ok) return r;

  const email = r.session.user.email?.toLowerCase();
  if (!email) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, is_active')
    .eq('email', email)
    .single();

  if (!appUser?.is_active || appUser.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, session: r.session };
}
