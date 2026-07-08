import { NextResponse } from 'next/server';
import { syncActiveEventExhibitorSignaturesFromDocuSign } from '@/lib/exhibitor-docusign-sync';
import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';
import { syncNyweCountersignaturesFromDocuSign } from '@/lib/nywe-sync-exhibitor-signatures';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Reconcile DocuSign signatures and auto-release signed contracts (WhiskyFest + NYWE). */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [exhibitor, countersign, accounting] = await Promise.all([
      syncActiveEventExhibitorSignaturesFromDocuSign({ batchSize: 40, notify: false }),
      syncNyweCountersignaturesFromDocuSign({ notify: false, limit: 30 }),
      releaseSignedContractsToAccounting({ limit: 100 }),
    ]);

    return NextResponse.json({
      ok: true,
      exhibitorSync: exhibitor,
      countersignSync: countersign,
      scanned: accounting.scanned,
      released: accounting.released,
      failed: accounting.failed,
      errors: accounting.errorSamples,
    });
  } catch (err) {
    console.error('[auto-release-accounting cron] reconcile failed', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}
