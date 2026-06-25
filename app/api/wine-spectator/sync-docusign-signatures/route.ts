import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import {
  syncAllNyweExhibitorSignaturesFromDocuSign,
  syncNyweExhibitorSignaturesFromDocuSign,
} from '@/lib/nywe-sync-exhibitor-signatures';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Poll DocuSign for winery signatures missed by Connect webhooks. */
export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const afterId = url.searchParams.get('afterId');
  const batchSize = Number(url.searchParams.get('batchSize') ?? '20');
  const all = url.searchParams.get('all') === '1';

  const result = all
    ? await syncAllNyweExhibitorSignaturesFromDocuSign({
        batchSize: Number.isFinite(batchSize) ? batchSize : 20,
        maxBatches: 40,
        notify: true,
      })
    : await syncNyweExhibitorSignaturesFromDocuSign({
        batchSize: Number.isFinite(batchSize) ? batchSize : 20,
        afterId,
        notify: true,
        concurrency: 3,
      });

  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator/contracts');

  return NextResponse.json({ ok: true, ...result });
}
