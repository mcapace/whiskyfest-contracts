#!/usr/bin/env tsx
/**
 * Apply Kate Brumley Big Smoke + all-reps assistant access against Supabase.
 * Loads .env.local if present. Does not print secrets.
 *
 *   npx tsx scripts/apply-kate-big-smoke-access.mts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const KATE = 'kbrumley@mshanken.com';

async function main() {
  const { data: before } = await supabase
    .from('app_users')
    .select('email, is_active, can_view_all_sales, is_big_smoke_admin')
    .eq('email', KATE)
    .maybeSingle();
  console.log('Before app_users:', before);

  const { error: upsertErr } = await supabase.from('app_users').upsert(
    {
      email: KATE,
      name: 'Katherine Brumley',
      role: 'sales_rep',
      is_active: true,
      can_view_all_sales: true,
      is_big_smoke_admin: true,
    },
    { onConflict: 'email' },
  );
  if (upsertErr) {
    // Fallback patch if upsert conflicts on extra columns
    const { error } = await supabase
      .from('app_users')
      .update({
        is_active: true,
        can_view_all_sales: true,
        is_big_smoke_admin: true,
        name: 'Katherine Brumley',
      })
      .eq('email', KATE);
    if (error) throw error;
  }

  const { data: reps, error: repsErr } = await supabase
    .from('sales_reps')
    .select('id, name, email')
    .eq('is_active', true);
  if (repsErr) throw repsErr;

  for (const rep of reps ?? []) {
    const { error } = await supabase.from('rep_assistants').upsert(
      { assistant_email: KATE, rep_id: rep.id },
      { onConflict: 'assistant_email,rep_id', ignoreDuplicates: true },
    );
    if (error && error.code !== '23505') {
      // try insert ignore via select-then-insert
      const { data: existing } = await supabase
        .from('rep_assistants')
        .select('id')
        .eq('assistant_email', KATE)
        .eq('rep_id', rep.id)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabase
          .from('rep_assistants')
          .insert({ assistant_email: KATE, rep_id: rep.id });
        if (insErr && insErr.code !== '23505') throw insErr;
      }
    }
  }

  const { data: after } = await supabase
    .from('app_users')
    .select('email, is_active, can_view_all_sales, is_big_smoke_admin')
    .eq('email', KATE)
    .maybeSingle();
  const { data: links } = await supabase
    .from('rep_assistants')
    .select('rep_id, sales_reps(name, email)')
    .eq('assistant_email', KATE);

  console.log('After app_users:', after);
  console.log(
    'Assistant links:',
    (links ?? []).map((r: { sales_reps?: { name?: string; email?: string } }) => ({
      name: r.sales_reps?.name,
      email: r.sales_reps?.email,
    })),
  );
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
