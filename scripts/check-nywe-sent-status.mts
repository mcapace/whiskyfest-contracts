#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: event } = await supabase
    .from('events')
    .select('id,name,is_active')
    .eq('product_key', 'wine_spectator')
    .eq('is_active', true)
    .maybeSingle();
  console.log('Active event:', event);

  const { data: byStatus } = await supabase.from('contracts').select('status').eq('event_id', event?.id ?? '');
  const counts: Record<string, number> = {};
  for (const r of byStatus ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log('Status counts:', counts);

  const { data: sent, count: sentTotal } = await supabase
    .from('contracts_with_totals')
    .select('id,exhibitor_company_name,status,docusign_envelope_id,updated_at', { count: 'exact' })
    .eq('event_id', event?.id ?? '')
    .eq('status', 'sent')
    .not('docusign_envelope_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(30);

  console.log('Total sent with envelope:', sentTotal);
  for (const c of sent ?? []) {
    console.log(' -', c.exhibitor_company_name, c.id.slice(0, 8), c.docusign_envelope_id?.slice(0, 12));
  }

  const { data: partial } = await supabase
    .from('contracts_with_totals')
    .select('id,exhibitor_company_name,updated_at')
    .eq('event_id', event?.id ?? '')
    .eq('status', 'partially_signed')
    .order('updated_at', { ascending: false });
  console.log('Partially signed:', partial?.length ?? 0);
  for (const c of partial ?? []) console.log(' *', c.exhibitor_company_name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
