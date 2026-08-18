import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isNyweVendorOnlyEvent } from '@/lib/nywe-pricing';
import {
  ensureNyweBoothQrLink,
  nyweBoothQrEligible,
  saveNyweWebsiteUrl,
} from '@/lib/nywe-booth-qr';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract, Event } from '@/types/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

function errorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : '';
  if (/not set/i.test(message)) return 503;
  if (/valid winery website|before printing/i.test(message)) return 400;
  return 500;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('contract_template_profile')
    .eq('id', gate.contract.event_id)
    .maybeSingle<Pick<Event, 'contract_template_profile'>>();

  if (!isNyweVendorOnlyEvent(event)) {
    return NextResponse.json({ error: 'Booth QR codes are only for Wine Spectator licenses.' }, { status: 400 });
  }
  if (!nyweBoothQrEligible(gate.contract)) {
    return NextResponse.json({ error: 'Booth QR is available after the vendor license is executed.' }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { websiteUrl?: string } | null;
  try {
    const url = await saveNyweWebsiteUrl(gate.contract as Contract, body?.websiteUrl ?? '');
    revalidateContractPaths(params.id);
    return NextResponse.json({ ok: true, exhibitor_website_url: url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save website.' },
      { status: errorStatus(err) },
    );
  }
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('year, contract_template_profile')
    .eq('id', gate.contract.event_id)
    .maybeSingle<Pick<Event, 'year' | 'contract_template_profile'>>();

  if (!isNyweVendorOnlyEvent(event)) {
    return NextResponse.json({ error: 'Booth QR codes are only for Wine Spectator licenses.' }, { status: 400 });
  }
  if (!nyweBoothQrEligible(gate.contract)) {
    return NextResponse.json({ error: 'Booth QR is available after the vendor license is executed.' }, { status: 409 });
  }

  try {
    const { png, filename, shortUrl } = await ensureNyweBoothQrLink(
      gate.contract as Contract,
      event?.year ?? new Date().getFullYear(),
    );
    revalidateContractPaths(params.id);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'X-Rebrandly-Short-Url': shortUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not create booth QR.' },
      { status: errorStatus(err) },
    );
  }
}
