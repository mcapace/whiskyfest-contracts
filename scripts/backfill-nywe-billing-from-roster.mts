#!/usr/bin/env npx tsx
/**
 * Backfill billing fields on existing NYWE licenses from linked Google Sheets roster rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-nywe-billing-from-roster.mts
 *   npx tsx scripts/backfill-nywe-billing-from-roster.mts --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { buildContractPayloadFromRosterRow, parseRosterRowKey } from '../lib/exhibitor-roster.ts';
import { contractHasNyweLicenseAddress } from '../lib/nywe-billing.ts';
import { getSheetsClient } from '../lib/sheets-tracker.ts';

const dryRun = process.argv.includes('--dry-run');

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const sheets = getSheetsClient();

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, event_id, source_sheet_id, source_sheet_tab, source_row_number, billing_address_line1')
    .not('source_sheet_id', 'is', null);

  if (error) throw error;

  let updated = 0;
  let skipped = 0;

  for (const row of contracts ?? []) {
    if (contractHasNyweLicenseAddress(row)) {
      skipped += 1;
      continue;
    }
    if (!row.source_sheet_id || !row.source_sheet_tab || !row.source_row_number) continue;

    const parsed = parseRosterRowKey(`${row.source_sheet_id}|${row.source_sheet_tab}|${row.source_row_number}`);
    if (!parsed) continue;

    const { data: event } = await supabase.from('events').select('*').eq('id', row.event_id).maybeSingle();
    if (!event || event.contract_template_profile !== 'nywe_vendor') continue;

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: parsed.spreadsheetId,
      range: tabRange(parsed.tab, 'A1:AZ1'),
    });
    const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
    const listKey = parsed.tab.toLowerCase().includes('new') ? 'new' : 'returning';

    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: parsed.spreadsheetId,
      range: tabRange(parsed.tab, `A${parsed.rowNumber}:AZ${parsed.rowNumber}`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const sheetRow = ((rowRes.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
    const payload = buildContractPayloadFromRosterRow(sheetRow, listKey, event, headers);
    if (!payload.billing) continue;

    if (dryRun) {
      console.log(`[dry-run] would update ${row.id}`, payload.billing);
    } else {
      const { error: updErr } = await supabase.from('contracts').update(payload.billing).eq('id', row.id);
      if (updErr) {
        console.error(`Failed ${row.id}:`, updErr.message);
        continue;
      }
    }
    updated += 1;
  }

  console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} licenses · skipped ${skipped} (already had address)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
