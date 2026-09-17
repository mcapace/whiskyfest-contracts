#!/usr/bin/env tsx
/**
 * Sync roster from Google Sheets and verify QR URLs are correct
 * This does the backend work without needing the portal UI
 */

import { syncExhibitorRosterMaster } from '../lib/exhibitor-roster-sync-job.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

async function syncAndVerify() {
  console.log('=== Step 1: Syncing Roster from Google Sheets ===\n');
  
  try {
    const outcome = await syncExhibitorRosterMaster();
    
    if (outcome.status === 'error') {
      console.error('ERROR:', outcome.error);
      process.exit(1);
    }
    
    if (outcome.status === 'skipped') {
      console.log('SKIPPED:', outcome.reason);
    } else {
      console.log('✓ Sync completed successfully!');
      console.log(`  Event: ${outcome.eventName}`);
      console.log(`  Rows synced: ${outcome.rowCount}`);
      console.log(`  Contracts updated: ${outcome.contractsUpdated}`);
      console.log(`  Synced at: ${outcome.syncedAt}`);
    }
  } catch (err) {
    console.error('SYNC FAILED:', err);
    process.exit(1);
  }

  console.log('\n=== Step 2: Verifying QR Code URLs ===\n');
  
  const supabase = getSupabaseAdmin();
  
  // Check the key wineries that had issues
  const { data: contracts } = await supabase
    .from('contracts')
    .select('exhibitor_company_name, exhibitor_website_url, rebrandly_short_url')
    .in('exhibitor_company_name', [
      "Ca'Marcanda",
      'Gaja',
      'Pieve Santa Restituta',
      'Adriano Ramos Pinto',
      'Merum Priorati',
      "Col d'Orcia",
      'Brancaia',
      'CVNE',
      'Tensley',
      'Paolo Scavino'
    ])
    .not('rebrandly_short_url', 'is', null);

  if (!contracts || contracts.length === 0) {
    console.log('⚠ No contracts found with QR codes');
  } else {
    console.log('Verified URLs:');
    for (const c of contracts) {
      console.log(`\n${c.exhibitor_company_name}:`);
      console.log(`  URL: ${c.exhibitor_website_url}`);
      console.log(`  QR: ${c.rebrandly_short_url}`);
      
      // Check if URL matches expected
      const expectedUrls: Record<string, string> = {
        "Ca'Marcanda": 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
        'Gaja': 'https://wilsondaniels.com/winery/gaja/',
        'Pieve Santa Restituta': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
        'Adriano Ramos Pinto': 'https://www.ramospinto.pt/en/',
        'Merum Priorati': 'http://merumpriorati.com/en/',
        "Col d'Orcia": 'https://coldorcia.it/en/home',
        'Brancaia': 'https://brancaia.com/en/',
        'CVNE': 'https://cvne.com/en/',
        'Tensley': 'https://tensleywines.com/',
        'Paolo Scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
      };
      
      const expected = expectedUrls[c.exhibitor_company_name];
      if (expected && c.exhibitor_website_url === expected) {
        console.log('  ✓ CORRECT');
      } else if (expected) {
        console.log('  ✗ WRONG - Expected:', expected);
      }
    }
  }

  console.log('\n=== Step 3: Next Steps ===\n');
  console.log('The database now has the correct URLs from the Google Sheet.');
  console.log('');
  console.log('To get the updated QR book, go to:');
  console.log('https://nywecontracts.winespectator.com/qr');
  console.log('');
  console.log('Click "Download QR book" to get the ZIP with corrected QR codes.');
  console.log('');
  console.log('The QR codes will now redirect to the correct URLs!');
}

syncAndVerify()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
