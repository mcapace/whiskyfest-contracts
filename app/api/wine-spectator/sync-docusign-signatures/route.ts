import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireWineSpectatorActor } from '@/lib/wine-spectator-api-auth';
import { reconcileNyweDocuSignPipeline } from '@/lib/nywe-sync-exhibitor-signatures';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Poll DocuSign for missed signatures and release countersigned licenses to accounting. */
export async function POST(req: Request) {
  const gate = await requireWineSpectatorActor();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const afterId = url.searchParams.get('afterId');
  const batchSize = Number(url.searchParams.get('batchSize') ?? '25');
  const all = url.searchParams.get('all') === '1';

  const result = await reconcileNyweDocuSignPipeline({
    exhibitorBatchSize: Number.isFinite(batchSize) ? batchSize : 25,
    exhibitorAll: all,
    afterId,
    notify: true,
    releaseLimit: 50,
  });

  revalidatePath('/wine-spectator');
  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator/contracts');
  revalidatePath('/accounting/nywe');

  const summary = {
    winerySigned: result.exhibitor.partiallySigned,
    fullySigned: result.exhibitor.fullySigned + result.countersign.fullySigned,
    releasedToAccounting: result.accounting.released,
    unchanged:
      result.exhibitor.unchanged + result.countersign.unchanged + (result.accounting.scanned - result.accounting.released - result.accounting.failed),
    errors: result.exhibitor.errors + result.countersign.errors + result.accounting.failed,
    remainingSent: result.exhibitor.remainingSent,
    hasMore: result.exhibitor.hasMore,
    nextAfterId: result.exhibitor.nextAfterId,
  };

  return NextResponse.json({ ok: true, ...result, summary });
}
