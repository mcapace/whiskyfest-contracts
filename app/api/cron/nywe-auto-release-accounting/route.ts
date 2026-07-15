import { NextResponse } from 'next/server';
import { isDocuSignBackgroundSyncDisabled } from '@/lib/docusign';
import {
  syncActiveEventExhibitorSignaturesFromDocuSign,
  type ExhibitorDocuSignSyncResult,
} from '@/lib/exhibitor-docusign-sync';
import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';
import { syncNyweCountersignaturesFromDocuSign } from '@/lib/nywe-sync-exhibitor-signatures';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 120;

function emptyExhibitorSync(): ExhibitorDocuSignSyncResult {
  return { scanned: 0, partiallySigned: 0, fullySigned: 0, unchanged: 0, errors: 0, errorSamples: [] };
}

/** Drain several DocuSign poll batches so completed countersignatures do not sit behind cooldown. */
async function drainExhibitorSignatureSync(): Promise<ExhibitorDocuSignSyncResult> {
  const totals = emptyExhibitorSync();
  for (let batch = 0; batch < 4; batch += 1) {
    const result = await syncActiveEventExhibitorSignaturesFromDocuSign({
      batchSize: 25,
      notify: false,
      concurrency: 3,
    });
    totals.scanned += result.scanned;
    totals.partiallySigned += result.partiallySigned;
    totals.fullySigned += result.fullySigned;
    totals.unchanged += result.unchanged;
    totals.errors += result.errors;
    totals.errorSamples.push(
      ...result.errorSamples.slice(0, Math.max(0, 8 - totals.errorSamples.length)),
    );
    if (result.scanned === 0 || result.errors > 0) break;
  }
  return totals;
}

/** Repair half-finished handoffs: executed_at set but status left at signed. */
async function repairSignedWithExecutedAt(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contracts')
    .update({ status: 'executed' })
    .eq('status', 'signed')
    .not('executed_at', 'is', null)
    .select('id');
  if (error) {
    console.error('[auto-release-accounting cron] repair signed→executed failed', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Reconcile DocuSign signatures and auto-release signed contracts (WhiskyFest + NYWE + Big Smoke). */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const repairedExecuted = await repairSignedWithExecutedAt();
    const exhibitor = isDocuSignBackgroundSyncDisabled()
      ? emptyExhibitorSync()
      : await drainExhibitorSignatureSync();
    const countersign = isDocuSignBackgroundSyncDisabled()
      ? { scanned: 0, fullySigned: 0, unchanged: 0, errors: 0, errorSamples: [] as { id: string; company: string; error: string }[] }
      : await syncNyweCountersignaturesFromDocuSign({ notify: false, limit: 40 });
    const accounting = await releaseSignedContractsToAccounting({ limit: 100 });

    return NextResponse.json({
      ok: true,
      repairedExecuted,
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
