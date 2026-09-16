#!/usr/bin/env tsx
/**
 * Update Rebrandly short link destinations for NYWE QR codes
 * This ensures existing QR codes redirect to the corrected winery URLs
 */

import { getSupabaseAdmin } from '../lib/supabase.js';
import { getRebrandlyLink, updateRebrandlyDestination } from '../lib/rebrandly.js';
import { nyweBoothQrTrackingUrl } from '../lib/nywe-booth-qr.js';
import type { Contract } from '../types/db.js';

type QrContract = Pick<
  Contract,
  'id' | 'exhibitor_company_name' | 'exhibitor_website_url' | 'rebrandly_link_id' | 'rebrandly_short_url'
>;

async function updateQrDestinations(eventId: string) {
  console.log('Fetching NYWE contracts with QR codes...');
  
  const supabase = getSupabaseAdmin();
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, rebrandly_link_id, rebrandly_short_url')
    .eq('event_id', eventId)
    .eq('status', 'executed')
    .neq('order_type', 'sponsorship_only')
    .not('rebrandly_link_id', 'is', null);

  if (error) {
    console.error('Error fetching contracts:', error);
    process.exit(1);
  }

  if (!contracts || contracts.length === 0) {
    console.log('No contracts found with QR codes');
    return;
  }

  console.log(`Found ${contracts.length} contracts with QR codes`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const contract of contracts as QrContract[]) {
    const linkId = contract.rebrandly_link_id;
    if (!linkId) {
      console.log(`[SKIP] ${contract.exhibitor_company_name}: No link ID`);
      skipped++;
      continue;
    }

    try {
      // Get current Rebrandly link
      const existing = await getRebrandlyLink(linkId);
      
      // Our tracking URL (goes through /b/[contractId] to track, then to winery)
      const trackingUrl = nyweBoothQrTrackingUrl(contract.id);

      if (existing.destination === trackingUrl) {
        console.log(`[OK] ${contract.exhibitor_company_name}: Already tracking correctly`);
        skipped++;
        continue;
      }

      // Update to tracking URL
      await updateRebrandlyDestination(linkId, trackingUrl);
      console.log(`[UPDATED] ${contract.exhibitor_company_name}: ${existing.destination} → ${trackingUrl}`);
      updated++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`[FAILED] ${contract.exhibitor_company_name}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${contracts.length}`);
}

// Get event ID from command line or use NYWE 2026 default
const eventId = process.argv[2];

if (!eventId) {
  console.error('Usage: tsx scripts/update-nywe-qr-destinations.mts <event-id>');
  console.error('');
  console.error('To find event ID, run:');
  console.error('  supabase sql "SELECT id, name, year FROM events WHERE product_key = \'wine_spectator\' ORDER BY year DESC"');
  process.exit(1);
}

updateQrDestinations(eventId)
  .then(() => {
    console.log('\nDone!');
    console.log('QR codes will now redirect through tracking URL, which uses updated exhibitor_website_url');
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
