#!/usr/bin/env npx tsx
/**
 * Full NYWE DocuSign refresh: sent → partially_signed → signed → executed.
 *
 * Usage:
 *   npx tsx scripts/sync-nywe-exhibitor-signatures.mts
 *   npx tsx scripts/sync-nywe-exhibitor-signatures.mts --dry-run
 */
import {
  reconcileNyweDocuSignPipeline,
  syncAllNyweExhibitorSignaturesFromDocuSign,
} from '../lib/nywe-sync-exhibitor-signatures.ts';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 500;

async function main() {
  if (dryRun) {
    const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!url || !key) throw new Error('Missing Supabase env vars');
    const { createClient } = await import('@supabase/supabase-js');
    const { fetchEnvelopeSigners, fetchEnvelopeStatus } = await import('../lib/docusign.ts');
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('product_key', 'wine_spectator')
      .eq('is_active', true)
      .maybeSingle();
    const { data: pending } = await supabase
      .from('contracts')
      .select('id,exhibitor_company_name,docusign_envelope_id')
      .eq('event_id', event?.id ?? '')
      .eq('status', 'sent')
      .not('docusign_envelope_id', 'is', null)
      .limit(limit);
    let winerySigned = 0;
    let fullySigned = 0;
    for (const row of pending ?? []) {
      const signers = await fetchEnvelopeSigners(row.docusign_envelope_id!);
      const { status } = await fetchEnvelopeStatus(row.docusign_envelope_id!);
      const r1 = signers.find((s) => s.routingOrder === '1') ?? signers[0];
      const r2 = signers.find((s) => s.routingOrder === '2');
      const r1Done = ['completed', 'signed'].includes((r1?.status ?? '').toLowerCase());
      const r2Done = r2 ? ['completed', 'signed'].includes((r2.status ?? '').toLowerCase()) : false;
      if (!r1Done) continue;
      console.log(`${row.exhibitor_company_name}: env=${status} r1=${r1?.status} r2=${r2?.status ?? 'n/a'}`);
      if (r2Done || status.toLowerCase() === 'completed') fullySigned += 1;
      else winerySigned += 1;
    }
    console.log({ winerySigned, fullySigned });
    return;
  }

  const result = await reconcileNyweDocuSignPipeline({
    exhibitorAll: true,
    exhibitorBatchSize: 25,
    notify: false,
    releaseLimit: 100,
  });

  console.log(JSON.stringify(result, null, 2));
  console.log('\nSummary:', {
    winerySigned: result.exhibitor.partiallySigned,
    fullySigned: result.exhibitor.fullySigned + result.countersign.fullySigned,
    releasedToAccounting: result.accounting.released,
    errors: result.exhibitor.errors + result.countersign.errors + result.accounting.failed,
    remainingSent: result.exhibitor.remainingSent,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
