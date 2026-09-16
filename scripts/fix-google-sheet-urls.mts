#!/usr/bin/env tsx
/**
 * Fix Google Sheet URLs for NYWE QR codes
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY environment variable
 */

import { google } from 'googleapis';

const SPREADSHEET_ID = '1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk';

// Official URLs from Susannah Nolan
const CORRECT_URLS: Record<string, string> = {
  "Ca'Marcanda": 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
  'Camarcanda': 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
  'GAJA': 'https://wilsondaniels.com/winery/gaja/',
  'Gaja': 'https://wilsondaniels.com/winery/gaja/',
  'Pieve Santa Restituta': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
  'Adriano Ramos Pinto': 'https://www.ramospinto.pt/en/',
  'Ramos Pinto': 'https://www.ramospinto.pt/en/',
  'Merum Priorati': 'http://merumpriorati.com/en/',
  "Col d'Orcia": 'https://coldorcia.it/en/home',
  'Coldorcia': 'https://coldorcia.it/en/home',
  'Brancaia': 'https://brancaia.com/en/',
  'CVNE': 'https://cvne.com/en/',
  'Tensley': 'https://tensleywines.com/',
  'Paolo Scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
  'Scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
};

async function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
  }

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth;
}

async function fixSheetUrls() {
  console.log('Authenticating with Google Sheets API...');
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Fetching spreadsheet data...');
  
  // Get all sheets/tabs
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log(`Found ${metadata.data.sheets?.length} tabs in spreadsheet`);

  for (const sheet of metadata.data.sheets || []) {
    const sheetName = sheet.properties?.title;
    if (!sheetName) continue;

    console.log(`\nChecking tab: ${sheetName}`);

    // Read the sheet data
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1000`, // Adjust range as needed
    });

    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      console.log('  No data found');
      continue;
    }

    // Find header row
    const headers = rows[0];
    const wineryNameCol = headers.findIndex(h => 
      h && /winery.*name/i.test(h) && !/legal/i.test(h)
    );
    const websiteCol = headers.findIndex(h => 
      h && /website.*url/i.test(h)
    );

    if (wineryNameCol === -1 || websiteCol === -1) {
      console.log('  Could not find winery name or website URL columns');
      continue;
    }

    console.log(`  Winery Name column: ${String.fromCharCode(65 + wineryNameCol)}`);
    console.log(`  Website URL column: ${String.fromCharCode(65 + websiteCol)}`);

    // Check each row
    const updates: { range: string; value: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const wineryName = row[wineryNameCol]?.trim();
      const currentUrl = row[websiteCol]?.trim() || '';

      if (!wineryName) continue;

      // Check if this winery needs updating
      const correctUrl = CORRECT_URLS[wineryName];
      if (correctUrl && currentUrl !== correctUrl) {
        const cellAddress = `${sheetName}!${String.fromCharCode(65 + websiteCol)}${i + 1}`;
        updates.push({ range: cellAddress, value: correctUrl });
        console.log(`  UPDATE: ${wineryName}`);
        console.log(`    From: ${currentUrl || '(empty)'}`);
        console.log(`    To: ${correctUrl}`);
      }
    }

    // Apply updates
    if (updates.length > 0) {
      console.log(`\n  Applying ${updates.length} updates...`);
      
      for (const update of updates) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: update.range,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[update.value]],
          },
        });
      }
      
      console.log('  ✓ Updates applied');
    } else {
      console.log('  No updates needed');
    }
  }

  console.log('\n=== Summary ===');
  console.log('Google Sheet URLs updated successfully!');
  console.log('\nNext steps:');
  console.log('1. Go to: https://nywecontracts.winespectator.com/roster');
  console.log('2. Click "Sync from Google Sheets" button');
  console.log('3. Wait for sync to complete');
  console.log('4. Tell Lisa to test QR codes');
}

fixSheetUrls()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
