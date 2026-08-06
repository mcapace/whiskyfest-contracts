#!/usr/bin/env tsx
/**
 * Apply migration 083 to fix Big Smoke template resolution.
 * 
 * This script requires Supabase credentials to be set in environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage:
 *   npx tsx scripts/run-migration-083.mts
 * 
 * Or with Vercel CLI (uses production env vars):
 *   vercel env pull .env.local
 *   npx tsx scripts/run-migration-083.mts
 */

import { getSupabaseAdmin } from '../lib/supabase';

async function main() {
  console.log('🚀 Running Migration 083: Fix Big Smoke Template Resolution\n');

  // Check credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials!\n');
    console.error('Required environment variables:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY\n');
    console.error('💡 To set up credentials:');
    console.error('   1. Using Vercel CLI: vercel env pull .env.local');
    console.error('   2. Or manually: cp .env.example .env.local (and fill in values)\n');
    process.exit(1);
  }

  console.log('✅ Credentials found');
  console.log(`📡 Supabase URL: ${supabaseUrl}\n`);

  const supabase = getSupabaseAdmin();

  // Check current Big Smoke events BEFORE migration
  console.log('📊 Checking Big Smoke events BEFORE migration...\n');
  
  const { data: beforeEvents, error: beforeError } = await supabase
    .from('events')
    .select('id, name, year, product_key, contract_template_profile, google_template_doc_id')
    .eq('product_key', 'big_smoke')
    .order('year', { ascending: false });

  if (beforeError) {
    console.error('❌ Error fetching events:', beforeError);
    process.exit(1);
  }

  if (!beforeEvents || beforeEvents.length === 0) {
    console.log('⚠️  No Big Smoke events found in database.');
    console.log('   This might be expected if you only have WhiskyFest/NYWE events.\n');
  } else {
    console.log('Big Smoke events BEFORE:');
    console.table(beforeEvents.map(e => ({
      name: e.name,
      year: e.year,
      template_id: e.google_template_doc_id ? `${e.google_template_doc_id.substring(0, 20)}...` : '(null)',
      profile: e.contract_template_profile
    })));
    console.log('');
  }

  // Execute migration 083
  console.log('🔄 Applying migration 083...\n');

  // Statement 1: Clear wrong template from non-Las Vegas events
  console.log('📝 Step 1: Clearing Las Vegas template from non-Las Vegas events...');
  const { error: clearError } = await supabase
    .from('events')
    .update({ google_template_doc_id: null })
    .eq('product_key', 'big_smoke')
    .eq('google_template_doc_id', '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8')
    .not('name', 'ilike', '%Las Vegas%')
    .neq('year', 2026);

  if (clearError) {
    console.error('❌ Error in step 1:', clearError);
    process.exit(1);
  }
  console.log('   ✅ Step 1 complete\n');

  // Statement 2: Ensure Las Vegas has correct template
  console.log('📝 Step 2: Ensuring Las Vegas 2026 has correct template...');
  const { error: setError } = await supabase
    .from('events')
    .update({ google_template_doc_id: '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8' })
    .eq('product_key', 'big_smoke')
    .eq('year', 2026)
    .ilike('name', '%Las Vegas%');

  if (setError) {
    console.error('❌ Error in step 2:', setError);
    process.exit(1);
  }
  console.log('   ✅ Step 2 complete\n');

  // Check events AFTER migration
  console.log('📊 Checking Big Smoke events AFTER migration...\n');
  
  const { data: afterEvents, error: afterError } = await supabase
    .from('events')
    .select('id, name, year, product_key, contract_template_profile, google_template_doc_id')
    .eq('product_key', 'big_smoke')
    .order('year', { ascending: false });

  if (afterError) {
    console.error('❌ Error fetching events:', afterError);
    process.exit(1);
  }

  if (afterEvents && afterEvents.length > 0) {
    console.log('Big Smoke events AFTER:');
    console.table(afterEvents.map(e => ({
      name: e.name,
      year: e.year,
      template_id: e.google_template_doc_id ? `${e.google_template_doc_id.substring(0, 20)}...` : '(null)',
      profile: e.contract_template_profile
    })));
    console.log('');
  }

  console.log('✅ Migration 083 applied successfully!\n');
  console.log('📋 What changed:');
  console.log('   - Las Vegas 2026: Has correct Big Smoke template');
  console.log('   - Other Big Smoke events: Template cleared (will use fallback)\n');
  console.log('🎯 Next steps:');
  console.log('   1. Void the old Agua Caliente contract (see VOID_OLD_CONTRACT_INSTRUCTIONS.md)');
  console.log('   2. Have Jake regenerate the contract');
  console.log('   3. It will now use the correct Big Smoke template!\n');
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
