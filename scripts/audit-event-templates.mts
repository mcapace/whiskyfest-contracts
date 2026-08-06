#!/usr/bin/env tsx
/**
 * Audit event template configurations to identify potential misconfigurations.
 * 
 * This script checks for:
 * 1. Big Smoke events missing google_template_doc_id
 * 2. Events with contract_template_profile that doesn't match product_key
 * 3. Events using fallback templates
 * 
 * Usage:
 *   npx tsx scripts/audit-event-templates.mts
 */

import { getSupabaseAdmin } from '../lib/supabase';
import { eventTemplateProfile } from '../lib/contract-template-profile';
import type { Event } from '../types/db';

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

  console.log('\n=== Event Template Configuration Audit ===\n');

  let hasIssues = false;

  for (const event of events as Event[]) {
    const profile = eventTemplateProfile(event);
    const issues: string[] = [];

    // Check 1: Big Smoke events should have their own template
    if (profile === 'big_smoke' && !event.google_template_doc_id?.trim()) {
      issues.push(
        `❌ Big Smoke event missing google_template_doc_id - will use Las Vegas fallback template`
      );
    }

    // Check 2: Template profile should match product_key
    if (event.product_key === 'big_smoke' && profile !== 'big_smoke') {
      issues.push(
        `⚠️  product_key is 'big_smoke' but template profile is '${profile}' - ` +
        `contracts will use wrong template!`
      );
    }

    if (event.product_key === 'wine_spectator' && profile === 'big_smoke') {
      issues.push(
        `⚠️  product_key is 'wine_spectator' but template profile is 'big_smoke' - ` +
        `contracts will use wrong template!`
      );
    }

    if (event.product_key === 'whiskyfest' && profile !== 'whiskyfest') {
      issues.push(
        `⚠️  product_key is 'whiskyfest' but template profile is '${profile}' - ` +
        `may cause template mismatch`
      );
    }

    // Check 3: Events without explicit template (will use fallback)
    if (!event.google_template_doc_id?.trim() && profile !== 'big_smoke') {
      issues.push(
        `ℹ️  No google_template_doc_id set - will use GOOGLE_TEMPLATE_DOC_ID fallback`
      );
    }

    if (issues.length > 0) {
      hasIssues = true;
      console.log(`\n📋 ${event.name} (${event.year})`);
      console.log(`   Product: ${event.product_key}`);
      console.log(`   Profile: ${profile}`);
      console.log(`   Template Doc ID: ${event.google_template_doc_id || '(not set)'}`);
      issues.forEach(issue => console.log(`   ${issue}`));
    }
  }

  if (!hasIssues) {
    console.log('✅ No template configuration issues found!\n');
  } else {
    console.log('\n' + '='.repeat(50));
    console.log('\n💡 Recommended Actions:');
    console.log('   1. For Big Smoke events: Set google_template_doc_id in the events table');
    console.log('   2. For mismatched profiles: Update contract_template_profile to match product_key');
    console.log('   3. Run this audit after making changes to verify fixes\n');
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
