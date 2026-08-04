#!/usr/bin/env npx tsx
/**
 * List in-flight / signed-but-not-executed contracts across all active events.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v && !process.env[k]) process.env[k] = v;
  }
  return true;
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env');

  const sb = createClient(url, key);
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id,name,year,product_key,is_active')
    .eq('is_active', true);
  if (evErr) throw new Error(evErr.message);

  console.log(
    'Active events:',
    (events ?? []).map((e) => `${e.product_key} ${e.name} ${e.year}`).join(' | '),
  );
  const eventIds = (events ?? []).map((e) => e.id as string);
  const byId = new Map((events ?? []).map((e) => [e.id as string, e]));

  const { data: rows, error } = await sb
    .from('contracts')
    .select(
      'id,status,exhibitor_company_name,event_id,docusign_envelope_id,sent_at,docusign_last_polled_at,executed_at,accounting_notified_at',
    )
    .in('event_id', eventIds)
    .in('status', ['sent', 'partially_signed', 'error', 'signed'])
    .order('sent_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const groups: Record<string, typeof rows> = {};
  for (const r of rows ?? []) {
    const ev = byId.get(r.event_id as string);
    const key = `${ev?.product_key ?? '?'} / ${r.status}`;
    (groups[key] ??= []).push(r);
  }

  for (const [k, list] of Object.entries(groups).sort()) {
    console.log(`\n=== ${k} (${list.length}) ===`);
    for (const r of list) {
      const ageMin = r.sent_at
        ? Math.round((Date.now() - new Date(r.sent_at as string).getTime()) / 60000)
        : null;
      const polled = r.docusign_last_polled_at
        ? `${Math.round((Date.now() - new Date(r.docusign_last_polled_at as string).getTime()) / 60000)}m ago`
        : 'never';
      console.log(
        `- ${r.exhibitor_company_name} | env=${r.docusign_envelope_id ? 'yes' : 'NO'} | sentAge=${ageMin ?? '?'}m | polled=${polled} | id=${r.id}`,
      );
    }
  }

  const signed = (rows ?? []).filter((r) => r.status === 'signed');
  console.log(`\nSigned awaiting release: ${signed.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
