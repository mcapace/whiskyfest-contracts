import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { isBigSmokeAdmin } from '@/lib/big-smoke-access';
import { isWineSpectatorAdmin } from '@/lib/wine-spectator-access';
import { PRODUCT_BIG_SMOKE, PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
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

/**
 * Create events:
 * - full admin: any product
 * - events team / Big Smoke admin: Big Smoke only
 */
export async function requireEventCreator(productKey: string): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const r = await requireAuth();
  if (!r.ok) return r;

  if (r.session.user.role === 'admin') return { ok: true, session: r.session };

  const canCreateBigSmoke =
    Boolean(r.session.user.is_events_team) || isBigSmokeAdmin(r.session.user);
  if (productKey === PRODUCT_BIG_SMOKE && canCreateBigSmoke) {
    return { ok: true, session: r.session };
  }

  return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

/** Full admin, Wine Spectator admin on NYWE events, or Big Smoke editor on BS events. */
export async function requireWineSpectatorEventEditor(eventId: string): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  return requireEventEditor(eventId);
}

export async function requireEventEditor(eventId: string): Promise<
  { ok: true; session: Session } | { ok: false; res: NextResponse }
> {
  const r = await requireAuth();
  if (!r.ok) return r;

  if (r.session.user.role === 'admin') return { ok: true, session: r.session };

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase.from('events').select('product_key').eq('id', eventId).maybeSingle();
  const productKey = event?.product_key;

  if (productKey === PRODUCT_WINE_SPECTATOR && isWineSpectatorAdmin(r.session.user)) {
    return { ok: true, session: r.session };
  }

  if (
    productKey === PRODUCT_BIG_SMOKE &&
    (isBigSmokeAdmin(r.session.user) || Boolean(r.session.user.is_events_team))
  ) {
    return { ok: true, session: r.session };
  }

  return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
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
