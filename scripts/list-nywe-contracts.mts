#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: events } = await supabase
    .from('events')
    .select('id,name')
    .eq('contract_template_profile', 'nywe_vendor');
  const eventIds = events?.map((e) => e.id) ?? [];
  const { data: contracts } = await supabase
    .from('contracts')
    .select(
      'id,exhibitor_company_name,billing_address_line1,billing_city,billing_state,billing_zip,signer_1_title,status,source_row_number',
    )
    .in('event_id', eventIds);
  for (const c of contracts ?? []) console.log(JSON.stringify(c));
  console.log('Total:', contracts?.length ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
