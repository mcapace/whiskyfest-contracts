import { NextResponse } from 'next/server';
import { loadExhibitorRoster } from '@/lib/exhibitor-roster-sync-job';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event found.' }, { status: 404 });
  }

  const forceLive = new URL(req.url).searchParams.get('live') === '1';

  try {
    const { roster, fromCache } = await loadExhibitorRoster(event, { forceLive });
    return NextResponse.json({
      event: { id: event.id, name: event.name, client_send_enabled: event.client_send_enabled },
      syncedAt: roster.syncedAt,
      fromCache,
      sheets: roster.sheets.map((sheet) => ({
        key: sheet.key,
        label: sheet.label,
        count: roster.rows.filter((row) => row.listKey === sheet.key).length,
      })),
      rows: roster.rows,
    });
  } catch (err) {
    console.error('[wine-spectator/roster] fetch failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load exhibitor roster' },
      { status: 500 },
    );
  }
}
