import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
  const role = (r.session.user as { role?: string }).role ?? 'sales';
  if (role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, session: r.session };
}
