import { NextResponse } from 'next/server';
import { syncExhibitorRosterMaster } from '@/lib/exhibitor-roster-sync-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Vercel Cron: refresh NYWE exhibitor master lists from Google Sheets. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const outcome = await syncExhibitorRosterMaster();

  if (outcome.status === 'error') {
    console.error('[cron/nywe-roster-sync]', outcome.error);
    return NextResponse.json({ status: 'error', error: outcome.error }, { status: 500 });
  }

  if (outcome.status === 'skipped') {
    return NextResponse.json({ status: 'skipped', reason: outcome.reason });
  }

  return NextResponse.json({
    status: 'synced',
    eventId: outcome.eventId,
    eventName: outcome.eventName,
    syncedAt: outcome.syncedAt,
    rowCount: outcome.rowCount,
    writebackCount: outcome.writebackCount,
  });
}
