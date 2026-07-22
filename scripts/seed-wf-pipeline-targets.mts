/**
 * Seed wf_pipeline_targets:
 * - pending_renewal from "2025 FINAL List" (RSVP Yes)
 * - new_business from Marvin-style inquiries sheet (optional) + 2026 master empty/pending inquiries
 *
 * Usage:
 *   npx tsx scripts/seed-wf-pipeline-targets.mts
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '../lib/sheets-tracker';
import {
  parseBoothCount,
  parseMoneyToCents,
  resolveRepEmailFromInitials,
} from '../lib/participation-report-shared';

for (const p of ['.env.local', '.env.vercel.tmp']) {
  try {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      const k = line.slice(0, i);
      const v = line.slice(i + 1).replace(/^"|"$/g, '');
      if (v && !process.env[k]) process.env[k] = v;
    }
  } catch {
    /* missing */
  }
}

const PENDING_SHEET_ID = '1ARk-1UtWazPk9qwUUEU1JY-85oeyPhumi67CQ9YFNNo';
const MARVIN_SHEET_ID = '10Wmm1V2B0z8olqutieFCM8iJeFCudEWHars6YPrv7GY';
const EVENT_ID = '286468da-a43c-4f66-b56c-4102b3c60b4a';

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').toString().trim();
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const sheets = getSheetsClient();

  const { data: reps } = await sb.from('sales_reps').select('id, email, name');
  const repByEmail = new Map((reps ?? []).map((r) => [String(r.email).toLowerCase(), r.id as string]));

  function repIdFromInitials(initials: string): string | null {
    const email = resolveRepEmailFromInitials(initials);
    if (!email) return null;
    return repByEmail.get(email) ?? null;
  }

  // Confirmed 2026 companies to skip from pending seed
  const { data: executed } = await sb
    .from('contracts')
    .select('exhibitor_company_name')
    .eq('event_id', EVENT_ID)
    .in('status', ['signed', 'executed']);
  const executedNames = new Set(
    (executed ?? []).map((r) => String(r.exhibitor_company_name).toLowerCase().trim()),
  );

  // --- Pending renewals from 2025 FINAL (RSVP Yes) ---
  const finalRes = await sheets.spreadsheets.values.get({
    spreadsheetId: PENDING_SHEET_ID,
    range: "'2025 FINAL List'!A3:N80",
  });
  const finalRows = finalRes.data.values ?? [];
  let pendingUpserts = 0;

  for (const row of finalRows) {
    const rsvp = cell(row, 0).toLowerCase();
    if (!rsvp.startsWith('yes')) continue;
    const company = cell(row, 3);
    if (!company || company.toLowerCase().includes('total')) continue;
    if ([...executedNames].some((n) => n === company.toLowerCase() || company.toLowerCase().includes(n) || n.includes(company.toLowerCase()))) {
      // still seed; report builder hides graduated — but skip exact executed matches to reduce clutter
      const exact = executedNames.has(company.toLowerCase());
      if (exact) continue;
    }

    const initials = cell(row, 2) || 'SS';
    const booths = parseBoothCount(cell(row, 4));
    const brands = cell(row, 5);
    const spend = parseMoneyToCents(cell(row, 6));
    const rate = booths > 0 ? Math.round(spend / booths) : 1_500_000;
    const notes = [cell(row, 11), cell(row, 8)].filter(Boolean).join(' — ') || null;

    const { error } = await sb.from('wf_pipeline_targets').upsert(
      {
        event_id: EVENT_ID,
        section: 'pending_renewal',
        company_name: company,
        sales_rep_id: repIdFromInitials(initials),
        brands_text: brands || null,
        booth_count: booths,
        rate_per_booth_cents: rate,
        sponsorship_cents: 0,
        total_spend_cents: spend || booths * rate,
        notes,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,section,company_name', ignoreDuplicates: false },
    );

    // Unique index is on lower(trim(company_name)) — upsert onConflict may not match.
    // Fall back to select + update/insert.
    if (error) {
      const { data: existing } = await sb
        .from('wf_pipeline_targets')
        .select('id')
        .eq('event_id', EVENT_ID)
        .eq('section', 'pending_renewal')
        .ilike('company_name', company)
        .eq('is_active', true)
        .maybeSingle();
      if (existing?.id) {
        await sb
          .from('wf_pipeline_targets')
          .update({
            sales_rep_id: repIdFromInitials(initials),
            brands_text: brands || null,
            booth_count: booths,
            rate_per_booth_cents: rate,
            total_spend_cents: spend || booths * rate,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        const { error: insErr } = await sb.from('wf_pipeline_targets').insert({
          event_id: EVENT_ID,
          section: 'pending_renewal',
          company_name: company,
          sales_rep_id: repIdFromInitials(initials),
          brands_text: brands || null,
          booth_count: booths,
          rate_per_booth_cents: rate,
          sponsorship_cents: 0,
          total_spend_cents: spend || booths * rate,
          notes,
          is_active: true,
        });
        if (insErr) console.error('pending insert', company, insErr.message);
        else pendingUpserts += 1;
        continue;
      }
    }
    pendingUpserts += 1;
  }

  // --- New business from Marvin sheet ---
  let newBiz = 0;
  try {
    const marvin = await sheets.spreadsheets.values.get({
      spreadsheetId: MARVIN_SHEET_ID,
      range: 'A43:H80',
    });
    const mrows = marvin.data.values ?? [];
    let inNewBiz = false;
    for (const row of mrows) {
      const a = cell(row, 0);
      if (a.toUpperCase().includes('NEW BUSINESS')) {
        inNewBiz = true;
        continue;
      }
      if (!inNewBiz) continue;
      if (a.toUpperCase() === 'TOTAL' || a.toUpperCase().includes('TOTAL')) break;
      if (a.toUpperCase() === 'SALES REP') continue;
      const company = cell(row, 1);
      if (!company) continue;
      const initials = a || 'SS';
      const brandsOrNotes = cell(row, 2);
      const { data: existing } = await sb
        .from('wf_pipeline_targets')
        .select('id')
        .eq('event_id', EVENT_ID)
        .eq('section', 'new_business')
        .ilike('company_name', company)
        .eq('is_active', true)
        .maybeSingle();
      if (existing?.id) continue;
      const { error } = await sb.from('wf_pipeline_targets').insert({
        event_id: EVENT_ID,
        section: 'new_business',
        company_name: company,
        sales_rep_id: repIdFromInitials(initials),
        brands_text: brandsOrNotes || null,
        booth_count: 0,
        rate_per_booth_cents: 0,
        sponsorship_cents: 0,
        total_spend_cents: 0,
        notes: brandsOrNotes || null,
        is_active: true,
      });
      if (error) console.error('newbiz', company, error.message);
      else newBiz += 1;
    }
  } catch (e) {
    console.warn('Marvin sheet seed skipped:', e instanceof Error ? e.message : e);
  }

  const { count } = await sb
    .from('wf_pipeline_targets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', EVENT_ID)
    .eq('is_active', true);

  console.log({ pendingUpserts, newBiz, totalActive: count });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
