import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { combineGalloContractsForEvent } from '@/lib/nywe-combine-gallo-contracts';
import { voidSentGalloContractsForEvent } from '@/lib/nywe-void-sent-gallo';
import { loadGalloDashboardSummary } from '@/lib/nywe-gallo-dashboard';
import { isNyweVendorOnlyEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** Dashboard card: load Gallo licenses directly from the database. */
export async function GET(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const preferredEventId = new URL(req.url).searchParams.get('eventId');
  const payload = await loadGalloDashboardSummary(preferredEventId);
  if (!payload) {
    return NextResponse.json({ summary: null });
  }
  return NextResponse.json(payload);
}

/** Fold Gallo winery licenses into one NYWE contract, optionally voiding sent envelopes first. */
export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const requestedId =
    body && typeof body === 'object' && typeof (body as { eventId?: unknown }).eventId === 'string'
      ? (body as { eventId: string }).eventId
      : null;
  const voidSent =
    body && typeof body === 'object' && (body as { voidSent?: unknown }).voidSent === true;

  if (voidSent && !gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Events team or admin access is required to void sent licenses.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const dashboard = await loadGalloDashboardSummary(requestedId);
  let event: Event | null = null;
  const eventId = dashboard?.eventId ?? requestedId;
  if (eventId) {
    const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle<Event>();
    event = data;
  } else {
    event = await getActiveWineSpectatorEvent();
  }
  if (!event || !isNyweVendorOnlyEvent(event)) {
    return NextResponse.json({ error: 'No active NYWE event.' }, { status: 404 });
  }

  let voidedIds: string[] = [];
  let additionalWineries: Awaited<ReturnType<typeof voidSentGalloContractsForEvent>>['wineries'] = [];
  if (voidSent) {
    const voided = await voidSentGalloContractsForEvent({
      supabase,
      event,
      actorEmail: gate.actor.email,
    });
    voidedIds = voided.voidedIds;
    additionalWineries = voided.wineries;
    if (voided.errors.length > 0 && voided.voidedIds.length === 0) {
      return NextResponse.json(
        {
          error: `Could not void sent Gallo licenses: ${voided.errors.map((entry) => entry.wineryName).join(', ')}`,
          errors: voided.errors,
        },
        { status: 502 },
      );
    }
  }

  const result = await combineGalloContractsForEvent({
    supabase,
    event,
    actorEmail: gate.actor.email,
    prepareToSend: true,
    additionalWineries,
  });

  if (!result.contractId) {
    return NextResponse.json(
      {
        error: voidSent
          ? 'Could not build the combined Gallo order after voiding. Check the roster for Gallo wineries.'
          : 'No unsent Gallo licenses to combine. If they were already sent, void those envelopes first.',
        voidedIds,
      },
      { status: 400 },
    );
  }

  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/contracts');
  revalidatePath(`/wine-spectator/contracts/${result.contractId}`);

  const feeCents = nyweLicenseFeeCents(event);
  return NextResponse.json({
    contractId: result.contractId,
    wineryCount: result.wineryCount,
    totalCents: result.wineryCount * feeCents,
    cancelledIds: result.cancelledIds,
    voidedIds,
  });
}
