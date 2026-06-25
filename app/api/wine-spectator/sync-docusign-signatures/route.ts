import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { syncNyweExhibitorSignaturesFromDocuSign } from '@/lib/nywe-sync-exhibitor-signatures';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Poll DocuSign for winery signatures missed by Connect webhooks. */
export async function POST() {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const result = await syncNyweExhibitorSignaturesFromDocuSign({ notify: true, maxContracts: 500 });

  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator/contracts');

  return NextResponse.json({ ok: true, ...result });
}
