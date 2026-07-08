#!/usr/bin/env npx tsx
/**
 * Diagnostic script to find contracts that might have mismatched event product_keys.
 * This helps identify cases where NYWE contracts are linked to WhiskyFest events or vice versa.
 * 
 * Run with: npx tsx scripts/diagnose-contract-event-mismatch.mts
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!url || !key) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('Fetching all active events...\n');
  
  // Fetch all events
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, name, year, product_key, is_active')
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }

  if (!events || events.length === 0) {
    console.log('No events found');
    return;
  }

  // Group events by product_key
  const eventsByProduct: Record<string, any[]> = {};
  for (const event of events) {
    const key = event.product_key || 'MISSING';
    if (!eventsByProduct[key]) {
      eventsByProduct[key] = [];
    }
    eventsByProduct[key].push(event);
  }

  console.log('Events by product_key:');
  for (const [productKey, eventList] of Object.entries(eventsByProduct)) {
    console.log(`  ${productKey}: ${eventList.length} events`);
    for (const evt of eventList) {
      console.log(`    - ${evt.name} (${evt.year}) [${evt.is_active ? 'active' : 'inactive'}]`);
    }
  }
  console.log('');

  // Fetch contracts with status='sent' (awaiting signature - these are the ones that would receive personal nudge emails)
  console.log('Fetching contracts in "sent" status (awaiting signature)...\n');
  
  const { data: sentContracts, error: contractsError } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, event_id, status, signer_1_email, created_at')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(100);

  if (contractsError) {
    throw new Error(`Failed to fetch contracts: ${contractsError.message}`);
  }

  if (!sentContracts || sentContracts.length === 0) {
    console.log('No contracts in "sent" status found');
    return;
  }

  console.log(`Found ${sentContracts.length} contracts in "sent" status\n`);

  // Match contracts with their events
  const eventMap = new Map(events.map(e => [e.id, e]));
  const mismatches: any[] = [];
  const byProduct: Record<string, number> = {};

  for (const contract of sentContracts) {
    const event = eventMap.get(contract.event_id);
    const productKey = event?.product_key || 'UNKNOWN';
    
    byProduct[productKey] = (byProduct[productKey] || 0) + 1;

    // Check for potential issues
    if (!event) {
      mismatches.push({
        contract_id: contract.id,
        exhibitor: contract.exhibitor_company_name,
        issue: 'Event not found',
        event_id: contract.event_id,
      });
    } else if (!event.product_key) {
      mismatches.push({
        contract_id: contract.id,
        exhibitor: contract.exhibitor_company_name,
        issue: 'Event missing product_key',
        event_name: event.name,
        event_id: event.id,
      });
    }
  }

  console.log('Contracts in "sent" status by product_key:');
  for (const [productKey, count] of Object.entries(byProduct)) {
    console.log(`  ${productKey}: ${count}`);
  }
  console.log('');

  if (mismatches.length > 0) {
    console.log(`⚠️  Found ${mismatches.length} potential issues:\n`);
    for (const issue of mismatches) {
      console.log(`  Contract ${issue.contract_id}`);
      console.log(`    Exhibitor: ${issue.exhibitor}`);
      console.log(`    Issue: ${issue.issue}`);
      if (issue.event_name) console.log(`    Event: ${issue.event_name}`);
      if (issue.event_id) console.log(`    Event ID: ${issue.event_id}`);
      console.log('');
    }
  } else {
    console.log('✓ No obvious issues found with sent contracts');
  }

  // Specific check for Wine Spectator contracts
  console.log('\nWine Spectator (NYWE) contracts in "sent" status:');
  const wineSpectatorEvents = events.filter(e => e.product_key === 'wine_spectator');
  const wineSpectatorEventIds = new Set(wineSpectatorEvents.map(e => e.id));
  const nyweContracts = sentContracts.filter(c => wineSpectatorEventIds.has(c.event_id));
  
  if (nyweContracts.length > 0) {
    console.log(`  Found ${nyweContracts.length} NYWE contracts awaiting signature:`);
    for (const contract of nyweContracts.slice(0, 10)) {
      const event = eventMap.get(contract.event_id);
      console.log(`    - ${contract.exhibitor_company_name}`);
      console.log(`      Contract ID: ${contract.id}`);
      console.log(`      Event: ${event?.name} (product_key: ${event?.product_key})`);
      console.log(`      Signer: ${contract.signer_1_email}`);
      console.log('');
    }
    if (nyweContracts.length > 10) {
      console.log(`    ... and ${nyweContracts.length - 10} more\n`);
    }
  } else {
    console.log('  No NYWE contracts in "sent" status\n');
  }

  console.log('Diagnostic complete.');
  console.log('\nTo test personal nudge email generation for a specific contract:');
  console.log('  - Check the logs when sending a personal nudge email');
  console.log('  - The logs will show the event product_key and generated base URL');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
