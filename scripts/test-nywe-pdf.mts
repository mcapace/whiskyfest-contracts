#!/usr/bin/env npx tsx
/** Generate a test PDF for one NYWE license and print merge token values. */
import { createClient } from '@supabase/supabase-js';
import { buildContractMergeMap } from '../lib/merge-map.ts';
import { renderContractPdfFromTemplate } from '../lib/google.ts';
import { writeFileSync } from 'node:fs';

const contractId = process.argv[2]?.trim();
if (!contractId) {
  console.error('Usage: npx tsx scripts/test-nywe-pdf.mts <contract-id>');
  process.exit(1);
}

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: contract, error } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contractId)
    .maybeSingle();
  if (error || !contract) throw new Error(error?.message ?? 'Contract not found');

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single();
  if (!event?.google_template_doc_id) throw new Error('Event missing template doc id');

  const mergeMap = buildContractMergeMap(contract, event, 'draft');
  const billingKeys = Object.entries(mergeMap).filter(([k]) => k.includes('billing') || k.includes('signer_1'));
  console.log('Merge values:');
  for (const [k, v] of billingKeys) console.log(`  ${k}: ${JSON.stringify(v)}`);

  const pdf = await renderContractPdfFromTemplate(
    event.google_template_doc_id,
    mergeMap,
    `TEST_${contract.exhibitor_company_name}`,
  );
  const out = `/tmp/nywe-test-${contractId.slice(0, 8)}.pdf`;
  writeFileSync(out, pdf);
  console.log('Wrote', out, `(${pdf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
