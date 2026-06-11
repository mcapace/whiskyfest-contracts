import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { isWineSpectatorAdmin } from '@/lib/wine-spectator-access';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
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

  const email = getEffectiveUserEmail(r.session);
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

/** Full admin, or Wine Spectator admin editing a wine_spectator event. */
export async function requireWineSpectatorEventEditor(eventId: string): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const r = await requireAuth();
  if (!r.ok) return r;

  if (r.session.user.role === 'admin') return { ok: true, session: r.session };

  if (!isWineSpectatorAdmin(r.session.user)) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase.from('events').select('product_key').eq('id', eventId).maybeSingle();
  if (event?.product_key !== PRODUCT_WINE_SPECTATOR) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, session: r.session };
}

/** Full admin, or Wine Spectator admin on a wine_spectator contract. */
export async function requireAdminOrWineSpectatorContractAdmin(contractId: string): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const r = await requireAuth();
  if (!r.ok) return r;

  if (r.session.user.role === 'admin') return { ok: true, session: r.session };

  if (!isWineSpectatorAdmin(r.session.user)) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from('contracts')
    .select('event_id, events!inner(product_key)')
    .eq('id', contractId)
    .maybeSingle();

  const productKey = (row as { events?: { product_key?: string } } | null)?.events?.product_key;
  if (productKey !== PRODUCT_WINE_SPECTATOR) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, session: r.session };
}
