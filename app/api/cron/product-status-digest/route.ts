import { NextResponse } from 'next/server';
import { runAllProductStatusDigests } from '@/lib/product-status-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekday status digests for portal owners:
 * Kate (WhiskyFest), Jake (Big Smoke), Susannah (NYWE).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { results } = await runAllProductStatusDigests({ recentHours: 8 });
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[cron/product-status-digest]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
