import { NextResponse } from 'next/server';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { syncExhibitorRosterMaster } from '@/lib/exhibitor-roster-sync-job';
import { liveRosterPullAllowed } from '@/lib/roster-sheets-pull-policy';
import {
  backfillNyweWebsitesFromRoster,
  ensureMissingNyweBoothQrLinks,
} from '@/lib/nywe-booth-qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event found.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { syncSheet?: boolean } | null;
  const syncSheet = body?.syncSheet === true;

  try {
    let sheetSynced = false;
    if (syncSheet && liveRosterPullAllowed(event)) {
      const outcome = await syncExhibitorRosterMaster(event);
      sheetSynced = outcome.status === 'synced';
    }
    const fresh = (await getActiveWineSpectatorEvent()) ?? event;
    const websitesUpdated = await backfillNyweWebsitesFromRoster(fresh);
    const { created, remaining, errors } = await ensureMissingNyweBoothQrLinks(fresh.id, fresh.year);
    return NextResponse.json({
      ok: true,
      sheetSynced,
      websitesUpdated,
      created,
      remaining,
      errors: errors.slice(0, 8),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not create booth QR short links.' },
      { status: 500 },
    );
  }
}
