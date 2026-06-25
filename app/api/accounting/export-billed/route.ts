import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { exportBilledExhibitorsToGoogleSheet } from '@/lib/sheets-billed-export';
import {
  PRODUCT_WHISKYFEST,
  PRODUCT_WINE_SPECTATOR,
} from '@/lib/product-portal';
import type { AccountingPortalKey } from '@/lib/accounting-portal';

export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({
  productKey: z.enum([PRODUCT_WHISKYFEST, PRODUCT_WINE_SPECTATOR]),
});

async function requireAccountingActor() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const isAdmin = session.user.role === 'admin';
  const isAccounting = Boolean(session.user.is_accounting);
  if (!isAdmin && !isAccounting) return null;

  const email = getEffectiveUserEmail(session);
  if (!email) return null;

  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase.from('app_users').select('is_active').eq('email', email).maybeSingle();
  if (!appUser?.is_active) return null;

  return { email };
}

/** POST — export all invoiced (sent + paid) exhibitors to Google Sheets. */
export async function POST(req: Request) {
  const actor = await requireAccountingActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await exportBilledExhibitorsToGoogleSheet(parsed.data.productKey as AccountingPortalKey);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    console.error('[export-billed]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
