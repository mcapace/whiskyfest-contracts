import { NextResponse } from 'next/server';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import {
  backfillNyweWebsitesFromRoster,
  ensureMissingNyweBoothQrLinks,
} from '@/lib/nywe-booth-qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event found.' }, { status: 404 });
  }

  try {
    const websitesUpdated = await backfillNyweWebsitesFromRoster(event);
    const { created, remaining, errors } = await ensureMissingNyweBoothQrLinks(event.id, event.year);
    return NextResponse.json({
      ok: true,
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
