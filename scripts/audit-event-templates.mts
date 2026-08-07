#!/usr/bin/env tsx
/**
 * Audit event template configurations to identify potential misconfigurations.
 *
 * Checks:
 * 1. Missing per-event templates (with portal-aware expectations)
 * 2. product_key vs contract_template_profile mismatches
 * 3. Cross-portal bleed: resolved sponsorship/booth IDs matching WhiskyFest env for non-WF events
 *
 * Usage:
 *   npx tsx scripts/audit-event-templates.mts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { resolveContractTemplateDocId } from '../lib/contract-template';
import { eventTemplateProfile } from '../lib/contract-template-profile';
import { getSupabaseAdmin } from '../lib/supabase';
import type { Event } from '../types/db';

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
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
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

async function main() {
  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('year', { ascending: false });

  if (error) {
    console.error('Error fetching events:', error);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log('No active events found.');
    return;
  }

  const wfBooth = process.env.GOOGLE_TEMPLATE_DOC_ID?.trim() ?? '';
  const wfSpo = process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim() ?? '';

  console.log('\n=== Event Template Configuration Audit ===\n');

  let hasIssues = false;

  for (const event of events as Event[]) {
    const profile = eventTemplateProfile(event);
    const issues: string[] = [];

    if (profile === 'big_smoke' && !event.google_template_doc_id?.trim()) {
      issues.push(
        `❌ Big Smoke event missing google_template_doc_id — will use Las Vegas BIG_SMOKE fallback`,
      );
    }

    if (profile === 'big_smoke' && !event.google_sponsorship_template_doc_id?.trim()) {
      issues.push(
        `⚠️  Big Smoke missing google_sponsorship_template_doc_id — sponsorship will reuse booth template`,
      );
    }

    if (profile === 'nywe_vendor' && !event.google_template_doc_id?.trim()) {
      issues.push(`❌ NYWE missing google_template_doc_id — license generate will fail closed`);
    }

    if (profile === 'nywe_vendor' && !event.google_sponsorship_template_doc_id?.trim()) {
      issues.push(
        `⚠️  NYWE missing google_sponsorship_template_doc_id — sponsorship falls back to license doc`,
      );
    }

    if (event.product_key === 'big_smoke' && profile !== 'big_smoke') {
      issues.push(
        `⚠️  product_key is 'big_smoke' but template profile is '${profile}' — wrong template path`,
      );
    }

    if (event.product_key === 'wine_spectator' && profile !== 'nywe_vendor') {
      issues.push(
        `⚠️  product_key is 'wine_spectator' but template profile is '${profile}' — wrong template path`,
      );
    }

    if (event.product_key === 'whiskyfest' && profile !== 'whiskyfest') {
      issues.push(
        `⚠️  product_key is 'whiskyfest' but template profile is '${profile}' — may cause mismatch`,
      );
    }

    let boothResolved = '';
    let spoResolved = '';
    try {
      boothResolved = resolveContractTemplateDocId({ order_type: 'booth', booth_count: 1 }, event);
      spoResolved = resolveContractTemplateDocId(
        { order_type: 'sponsorship_only', booth_count: 0 },
        event,
      );
    } catch (err) {
      issues.push(`❌ resolve threw: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (event.product_key !== 'whiskyfest') {
      if (wfBooth && boothResolved === wfBooth) {
        issues.push(`❌ CROSS-PORTAL BLEED: booth resolved to WhiskyFest GOOGLE_TEMPLATE_DOC_ID`);
      }
      if (wfSpo && spoResolved === wfSpo) {
        issues.push(
          `❌ CROSS-PORTAL BLEED: sponsorship resolved to WhiskyFest GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID`,
        );
      }
    }

    if (issues.length > 0) {
      hasIssues = true;
      console.log(`\n📋 ${event.name} (${event.year})`);
      console.log(`   Product: ${event.product_key}`);
      console.log(`   Profile: ${profile}`);
      console.log(`   Booth doc: ${event.google_template_doc_id || '(not set)'} → ${boothResolved || '(error)'}`);
      console.log(
        `   Sponsorship doc: ${event.google_sponsorship_template_doc_id || '(not set)'} → ${spoResolved || '(error)'}`,
      );
      issues.forEach((issue) => console.log(`   ${issue}`));
    }
  }

  if (!hasIssues) {
    console.log('✅ No template configuration issues found!\n');
  } else {
    console.log('\n' + '='.repeat(50));
    console.log('\n💡 Recommended Actions:');
    console.log('   1. Set events.google_template_doc_id for every production event');
    console.log('   2. Set events.google_sponsorship_template_doc_id for sponsorship deals');
    console.log('   3. Keep contract_template_profile aligned with product_key');
    console.log('   4. Re-run: npx tsx scripts/assert-template-portal-isolation.mts\n');
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
