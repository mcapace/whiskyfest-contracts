#!/usr/bin/env tsx
/**
 * Check for contracts that might have mismatched event product_key values.
 * This helps identify cases where NYWE contracts are linked to WhiskyFest events or vice versa.
 */

import { getSupabaseAdmin } from '../lib/supabase.js';

async function main() {
  const supabase = getSupabaseAdmin();

  // Fetch all contracts with their events
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select(`
      id,
      exhibitor_company_name,
      status,
      event_id,
      events (
        id,
        name,
        year,
        product_key
      )
    `)
    .not('status', 'in', '(cancelled,voided)')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching contracts:', error);
    process.exit(1);
  }

  if (!contracts || contracts.length === 0) {
    console.log('No contracts found');
    return;
  }

  console.log(`Checking ${contracts.length} contracts...`);
  console.log('');

  // Group by product_key
  const byProductKey: Record<string, any[]> = {};
  for (const contract of contracts) {
    const event = Array.isArray(contract.events) ? contract.events[0] : contract.events;
    const productKey = event?.product_key ?? 'MISSING';
    if (!byProductKey[productKey]) {
      byProductKey[productKey] = [];
    }
    byProductKey[productKey].push({ contract, event });
  }

  // Report counts
  console.log('Contract counts by product_key:');
  for (const [key, items] of Object.entries(byProductKey)) {
    console.log(`  ${key}: ${items.length}`);
  }
  console.log('');

  // Check for potential issues
  const missing = byProductKey['MISSING'] || [];
  if (missing.length > 0) {
    console.log('⚠️  CONTRACTS WITH MISSING PRODUCT_KEY:');
    for (const { contract, event } of missing) {
      console.log(`  - ${contract.id} | ${contract.exhibitor_company_name} | Event: ${event?.name || 'UNKNOWN'}`);
    }
    console.log('');
  }

  // Check for contracts in "sent" status
  const sentContracts = contracts.filter((c) => c.status === 'sent');
  if (sentContracts.length > 0) {
    console.log(`Found ${sentContracts.length} contracts in "sent" status (awaiting signature):`);
    for (const contract of sentContracts.slice(0, 10)) {
      const event = Array.isArray(contract.events) ? contract.events[0] : contract.events;
      console.log(`  - ${contract.id} | ${contract.exhibitor_company_name} | ${event?.product_key} | ${event?.name}`);
    }
    if (sentContracts.length > 10) {
      console.log(`  ... and ${sentContracts.length - 10} more`);
    }
    console.log('');
  }

  // Check wine_spectator contracts
  const nyweContracts = byProductKey['wine_spectator'] || [];
  if (nyweContracts.length > 0) {
    console.log(`Found ${nyweContracts.length} Wine Spectator contracts`);
    const nyweSent = nyweContracts.filter((item) => item.contract.status === 'sent');
    if (nyweSent.length > 0) {
      console.log(`  ${nyweSent.length} are in "sent" status`);
    }
  }

  console.log('');
  console.log('✓ Check complete');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
