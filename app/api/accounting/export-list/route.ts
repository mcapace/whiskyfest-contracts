import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildAccountingListCsv,
  buildAccountingListExcel,
  exportAccountingListToGoogleSheet,
  queryAccountingList,
} from '@/lib/accounting-list-export';
import {
  PRODUCT_BIG_SMOKE,
  PRODUCT_WHISKYFEST,
  PRODUCT_WINE_SPECTATOR,
} from '@/lib/product-portal';
import type { AccountingPortalKey } from '@/lib/accounting-portal';

export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({
  productKey: z.enum([PRODUCT_WHISKYFEST, PRODUCT_WINE_SPECTATOR, PRODUCT_BIG_SMOKE]),
  format: z.enum(['csv', 'xlsx', 'sheets']),
  invoice: z.string().optional(),
  q: z.string().optional(),
  rep: z.string().optional(),
  event: z.string().optional(),
  sort: z.string().optional(),
  dir: z.string().optional(),
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

/** POST — export filtered AR list as CSV, Excel, or Google Sheets. */
export async function POST(req: Request) {
  const actor = await requireAccountingActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const productKey = parsed.data.productKey as AccountingPortalKey;
  const filters = {
    productKey,
    invoice: parsed.data.invoice,
    q: parsed.data.q,
    rep: parsed.data.rep,
    eventId: parsed.data.event,
    sort: parsed.data.sort,
    dir: parsed.data.dir,
  };

  try {
    if (parsed.data.format === 'sheets') {
      const result = await exportAccountingListToGoogleSheet(filters);
      return NextResponse.json({ ok: true, ...result });
    }

    const { rows, productLabel } = await queryAccountingList(filters);
    const slug = productLabel.replace(/\s+/g, '-').toLowerCase();

    if (parsed.data.format === 'csv') {
      const csv = buildAccountingListCsv(rows, productKey);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}-accounting.csv"`,
        },
      });
    }

    const buffer = await buildAccountingListExcel(rows, productKey, productLabel);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${slug}-accounting.xlsx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    console.error('[accounting-export-list]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
