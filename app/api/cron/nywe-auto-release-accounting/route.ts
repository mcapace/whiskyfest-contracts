import { NextResponse } from 'next/server';
import { reconcileNyweDocuSignPipeline } from '@/lib/nywe-sync-exhibitor-signatures';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Retry NYWE DocuSign reconciliation: signatures, countersignatures, and release to accounting. */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await reconcileNyweDocuSignPipeline({
    exhibitorBatchSize: 20,
    exhibitorAll: false,
    notify: false,
    releaseLimit: 25,
  }).catch((err) => {
    console.error('[nywe-auto-release-accounting cron] reconcile failed', err);
    return null;
  });

  if (!result) {
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    exhibitorSync: result.exhibitor,
    countersignSync: result.countersign,
    scanned: result.accounting.scanned,
    released: result.accounting.released,
    failed: result.accounting.failed,
    errors: result.accounting.errorSamples,
  });
}
