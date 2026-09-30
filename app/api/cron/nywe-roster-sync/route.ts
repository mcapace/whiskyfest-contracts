import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  applyPendingGalloMutualIndemnification,
  pendingGalloIndemnificationToken,
} from '@/lib/gallo-indemnification-resend';
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
function tokenMatches(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env['CRON_SECRET']?.trim();
  const cronOk = Boolean(secret && authHeader === `Bearer ${secret}`);
  const pendingToken = await pendingGalloIndemnificationToken().catch((err) => {
    console.error('[cron/nywe-roster-sync] gallo token lookup failed', err);
    return null;
  });
  const tokenOk = tokenMatches(
    pendingToken ?? '',
    pendingToken ? request.headers.get('x-gallo-indemnification-token') : null,
  );
  if (!cronOk && !tokenOk) {
    return new Response('Unauthorized', { status: 401 });
  }

  let galloIndemnification: { applied: boolean; reason?: string; envelopeId?: string; error?: string } | null =
    null;
  if (pendingToken) {
    try {
      galloIndemnification = await applyPendingGalloMutualIndemnification();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[cron/nywe-roster-sync] gallo indemnification failed', error);
      galloIndemnification = { applied: false, error };
    }
  }

  if (!cronOk) {
    return NextResponse.json({ status: 'gallo_indemnification', galloIndemnification });
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
      galloIndemnification,
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
    galloIndemnification,
  });
}
