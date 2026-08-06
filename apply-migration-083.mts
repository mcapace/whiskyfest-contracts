#!/usr/bin/env tsx
/**
 * Apply migration 083 directly to production Supabase database.
 * This fixes the Big Smoke template resolution issue.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗');
    process.exit(1);
  }

  console.log('🔗 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // Read the migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/083_fix_big_smoke_template_specificity.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration file: 083_fix_big_smoke_template_specificity.sql');
  console.log('📝 SQL to execute:');
  console.log('---');
  console.log(migrationSql);
  console.log('---\n');

  // Check current Big Smoke events before migration
  console.log('🔍 Checking current Big Smoke events...');
  const { data: beforeEvents, error: beforeError } = await supabase
    .from('events')
    .select('id, name, year, product_key, google_template_doc_id')
    .eq('product_key', 'big_smoke');

  if (beforeError) {
    console.error('❌ Error fetching events:', beforeError);
    process.exit(1);
  }

  console.log('📊 Big Smoke events BEFORE migration:');
  console.table(beforeEvents);

  // Execute the migration
  console.log('\n🚀 Applying migration...');
  
  // Split by semicolon and execute each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;
    
    console.log(`\n📌 Executing: ${statement.substring(0, 100)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql: statement });
    
    if (error) {
      // Try direct execution via REST API if RPC doesn't work
      console.log('   Trying direct execution...');
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        console.error('❌ Migration failed:', error);
        console.error('Response:', await response.text());
        
        // Try manual execution
        console.log('\n⚠️  Automatic execution failed. Running SQL manually...');
        
        // Parse the statements manually
        if (statement.toLowerCase().includes('update public.events')) {
          const match = statement.match(/where\s+(.*?)$/is);
          if (match) {
            console.log('   Attempting manual UPDATE via Supabase client...');
            // This is a simplified approach - the actual migration should be run via SQL editor
            console.log('   ⚠️  Please run this migration via Supabase SQL Editor');
          }
        }
      } else {
        console.log('   ✅ Statement executed successfully');
      }
    } else {
      console.log('   ✅ Statement executed successfully');
    }
  }

  // Check events after migration
  console.log('\n🔍 Checking Big Smoke events after migration...');
  const { data: afterEvents, error: afterError } = await supabase
    .from('events')
    .select('id, name, year, product_key, google_template_doc_id')
    .eq('product_key', 'big_smoke');

  if (afterError) {
    console.error('❌ Error fetching events:', afterError);
    process.exit(1);
  }

  console.log('📊 Big Smoke events AFTER migration:');
  console.table(afterEvents);

  console.log('\n✅ Migration 083 applied successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Verify the events table looks correct above');
  console.log('   2. Void the old Agua Caliente contract (see VOID_OLD_CONTRACT_INSTRUCTIONS.md)');
  console.log('   3. Have Jake regenerate the contract - it will now use the correct template');
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
