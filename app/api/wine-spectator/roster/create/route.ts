import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createContractsFromRosterRows } from '@/lib/exhibitor-roster-create';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        rowKey: z.string().min(1),
        listKey: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event found.' }, { status: 404 });
  }

  const result = await createContractsFromRosterRows({
    event,
    items: parsed.data.items,
    actorEmail: gate.actor.email,
  });

  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/contracts');

  return NextResponse.json(result);
}
