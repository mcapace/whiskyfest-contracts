import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncExhibitorRosterMaster } from '@/lib/exhibitor-roster-sync-job';
import {
  backfillNyweWebsitesFromRoster,
  ensureMissingNyweBoothQrLinks,
  refreshNyweQrClicks,
} from '@/lib/nywe-booth-qr';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** Vercel Cron: refresh NYWE exhibitor master lists from Google Sheets. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const outcome = await syncExhibitorRosterMaster();
  const event = await getActiveWineSpectatorEvent();
  let qrClicksUpdated = 0;
  let websitesUpdated = 0;
  let shortLinksCreated = 0;
  if (event?.id) {
    websitesUpdated = await backfillNyweWebsitesFromRoster(event).catch((err) => {
      console.warn('[cron/nywe-roster-sync] website backfill failed', err instanceof Error ? err.message : err);
      return 0;
    });
    const links = await ensureMissingNyweBoothQrLinks(event.id, event.year).catch((err) => {
      console.warn('[cron/nywe-roster-sync] short link create failed', err instanceof Error ? err.message : err);
      return { created: 0, remaining: 0, errors: [] as string[] };
    });
    shortLinksCreated = links.created;
    qrClicksUpdated = await refreshNyweQrClicks(event.id).catch((err) => {
      console.warn('[cron/nywe-roster-sync] QR click refresh failed', err instanceof Error ? err.message : err);
      return 0;
    });
  }

  if (outcome.status === 'error') {
    console.error('[cron/nywe-roster-sync]', outcome.error);
    return NextResponse.json({ status: 'error', error: outcome.error }, { status: 500 });
  }

  if (outcome.status === 'skipped') {
    return NextResponse.json({
      status: 'skipped',
      reason: outcome.reason,
      websitesUpdated,
      shortLinksCreated,
      qrClicksUpdated,
    });
  }

  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator/qr');
  revalidatePath('/wine-spectator/contracts');
  revalidatePath('/contracts');

  return NextResponse.json({
    status: 'synced',
    eventId: outcome.eventId,
    eventName: outcome.eventName,
    syncedAt: outcome.syncedAt,
    rowCount: outcome.rowCount,
    writebackCount: outcome.writebackCount,
    contractsUpdated: outcome.contractsUpdated,
    websitesUpdated,
    shortLinksCreated,
    qrClicksUpdated,
  });
}
