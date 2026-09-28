import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { combineGalloContractsForEvent } from '@/lib/nywe-combine-gallo-contracts';
import { isNyweVendorOnlyEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Fold unsent Gallo winery licenses into one NYWE contract. */
export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const requestedId =
    body && typeof body === 'object' && typeof (body as { eventId?: unknown }).eventId === 'string'
      ? (body as { eventId: string }).eventId
      : null;

  const supabase = getSupabaseAdmin();
  let event: Event | null = null;
  if (requestedId) {
    const { data } = await supabase.from('events').select('*').eq('id', requestedId).maybeSingle<Event>();
    event = data;
  } else {
    event = await getActiveWineSpectatorEvent();
  }
  if (!event || !isNyweVendorOnlyEvent(event)) {
    return NextResponse.json({ error: 'No active NYWE event.' }, { status: 404 });
  }

  const result = await combineGalloContractsForEvent({
    supabase,
    event,
    actorEmail: gate.actor.email,
  });

  if (!result.contractId) {
    return NextResponse.json(
      { error: 'No unsent Gallo licenses to combine. Contracts already sent stay separate.' },
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
  });
}
