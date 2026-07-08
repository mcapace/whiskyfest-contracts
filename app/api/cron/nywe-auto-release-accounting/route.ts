import { NextResponse } from 'next/server';
import { isDocuSignBackgroundSyncDisabled } from '@/lib/docusign';
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
    const exhibitor = isDocuSignBackgroundSyncDisabled()
      ? { scanned: 0, partiallySigned: 0, fullySigned: 0, unchanged: 0, errors: 0, errorSamples: [] }
      : await syncActiveEventExhibitorSignaturesFromDocuSign({ batchSize: 25, notify: false });
    const countersign = isDocuSignBackgroundSyncDisabled()
      ? { scanned: 0, partiallySigned: 0, fullySigned: 0, unchanged: 0, errors: 0, errorSamples: [], nextAfterId: null, hasMore: false, remainingSent: 0 }
      : await syncNyweCountersignaturesFromDocuSign({ notify: false, limit: 20 });
    const accounting = await releaseSignedContractsToAccounting({ limit: 100 });

    return NextResponse.json({
      ok: true,
      exhibitorSync: exhibitor,
      countersignSync: countersign,
      scanned: accounting.scanned,
      released: accounting.released,
      failed: accounting.failed,
      errors: accounting.errorSamples,
      docusignSyncDisabled: isDocuSignBackgroundSyncDisabled(),
    });
  } catch (err) {
    console.error('[auto-release-accounting cron] reconcile failed', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}
