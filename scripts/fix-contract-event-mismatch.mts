#!/usr/bin/env npx tsx
/**
 * Fix script to reassign contracts to the correct event based on business logic.
 * 
 * This script identifies contracts that might be linked to events with mismatched
 * product_keys and provides options to fix them.
 * 
 * DRY RUN by default - use --apply flag to actually make changes.
 * 
 * Run with: npx tsx scripts/fix-contract-event-mismatch.mts [--apply]
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!url || !key) {
    throw new Error('Missing Supabase env vars');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Use --apply flag to execute fixes\n');
  } else {
    console.log('⚠️  APPLY MODE - Changes will be made to the database\n');
  }

  // Fetch all events
  const { data: events } = await supabase
    .from('events')
    .select('id, name, year, product_key, contract_template_profile, is_active')
    .order('created_at', { ascending: false });

  if (!events || events.length === 0) {
    console.log('No events found');
    return;
  }

  // Find Wine Spectator events (these should have product_key = 'wine_spectator')
  const wineSpectatorEvents = events.filter(e => e.product_key === 'wine_spectator');
  const whiskyfestEvents = events.filter(e => e.product_key === 'whiskyfest');

  console.log(`Found ${wineSpectatorEvents.length} Wine Spectator events`);
  console.log(`Found ${whiskyfestEvents.length} WhiskyFest events\n`);

  // Look for contracts that might be in the wrong place
  // Heuristic: contracts with contract_template_profile indicators or source_sheet_id (NYWE roster)
  
  const { data: suspectContracts } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, event_id, status, source_sheet_id, created_at')
    .not('status', 'in', '(cancelled,voided)')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!suspectContracts || suspectContracts.length === 0) {
    console.log('No contracts to check');
    return;
  }

  const eventMap = new Map(events.map(e => [e.id, e]));
  const issues: any[] = [];

  // Check for NYWE contracts (those with source_sheet_id) linked to WhiskyFest events
  for (const contract of suspectContracts) {
    const event = eventMap.get(contract.event_id);
    
    if (!event) {
      issues.push({
        contract,
        issue: 'event_not_found',
        message: `Contract ${contract.id} references non-existent event ${contract.event_id}`,
      });
      continue;
    }

    // NYWE contracts should be linked to wine_spectator events
    if (contract.source_sheet_id && event.product_key !== 'wine_spectator') {
      issues.push({
        contract,
        event,
        issue: 'nywe_contract_wrong_event',
        message: `NYWE roster contract "${contract.exhibitor_company_name}" is linked to ${event.product_key} event "${event.name}"`,
        suggested_fix: 'Should be linked to a Wine Spectator event',
      });
    }
  }

  if (issues.length === 0) {
    console.log('✓ No mismatched contracts found\n');
    return;
  }

  console.log(`Found ${issues.length} contracts with potential issues:\n`);
  
  for (const issue of issues) {
    console.log(`Issue: ${issue.issue}`);
    console.log(`  ${issue.message}`);
    if (issue.suggested_fix) {
      console.log(`  Suggestion: ${issue.suggested_fix}`);
    }
    console.log(`  Contract ID: ${issue.contract.id}`);
    console.log(`  Status: ${issue.contract.status}`);
    if (issue.event) {
      console.log(`  Current Event: ${issue.event.name} (${issue.event.product_key})`);
    }
    console.log('');
  }

  // For NYWE contracts in wrong events, suggest moving them to active Wine Spectator event
  const nyweIssues = issues.filter(i => i.issue === 'nywe_contract_wrong_event');
  
  if (nyweIssues.length > 0 && wineSpectatorEvents.length > 0) {
    const activeWineEvent = wineSpectatorEvents.find(e => e.is_active);
    
    if (!activeWineEvent) {
      console.log('⚠️  No active Wine Spectator event found - cannot auto-fix\n');
      return;
    }

    console.log(`\nSuggested fix: Move ${nyweIssues.length} NYWE contracts to "${activeWineEvent.name}"\n`);

    if (!DRY_RUN) {
      console.log('Applying fixes...\n');
      let fixed = 0;

      for (const issue of nyweIssues) {
        const { error } = await supabase
          .from('contracts')
          .update({ event_id: activeWineEvent.id })
          .eq('id', issue.contract.id);

        if (error) {
          console.error(`  ❌ Failed to fix ${issue.contract.id}: ${error.message}`);
        } else {
          console.log(`  ✓ Fixed contract ${issue.contract.id} - moved to ${activeWineEvent.name}`);
          fixed++;
        }
      }

      console.log(`\n✓ Fixed ${fixed} of ${nyweIssues.length} contracts\n`);
    } else {
      console.log('DRY RUN - No changes made. Use --apply to execute fixes.\n');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
