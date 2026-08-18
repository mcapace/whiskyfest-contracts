import { NextResponse } from 'next/server';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { buildNyweBoothQrBook } from '@/lib/nywe-booth-qr-book';
import { NYWE_EVENT_NAME } from '@/lib/nywe-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event found.' }, { status: 404 });
  }

  try {
    const { zip, filename, readyCount, skippedCount } = await buildNyweBoothQrBook({
      eventId: event.id,
      eventYear: event.year,
      eventName: event.name || NYWE_EVENT_NAME,
    });
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'X-Nywe-Qr-Ready': String(readyCount),
        'X-Nywe-Qr-Skipped': String(skippedCount),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not build the booth QR book.';
    const status = /no booth qrs|no executed/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
