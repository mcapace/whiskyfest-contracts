/**
 * Google Apps Script to fix winery URLs in NYWE roster
 * 
 * To use:
 * 1. Open the Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this code
 * 4. Click "Run" and select fixWineryUrls
 * 5. Authorize when prompted
 * 6. Check the execution log for results
 */

function fixWineryUrls() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Find header row
  const headers = data[0];
  const wineryNameCol = headers.findIndex(h => 
    h && /winery.*name/i.test(h) && !/legal/i.test(h)
  );
  const websiteCol = headers.findIndex(h => 
    h && /website.*url/i.test(h)
  );
  
  if (wineryNameCol === -1 || websiteCol === -1) {
    Logger.log('ERROR: Could not find winery name or website URL columns');
    return;
  }
  
  Logger.log('Winery Name column: ' + String.fromCharCode(65 + wineryNameCol));
  Logger.log('Website URL column: ' + String.fromCharCode(65 + websiteCol));
  
  // Official URLs from Susannah Nolan
  const correctUrls = {
    "Ca'Marcanda": 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
    'Camarcanda': 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
    'GAJA': 'https://wilsondaniels.com/winery/gaja/',
    'Gaja': 'https://wilsondaniels.com/winery/gaja/',
    'Pieve Santa Restituta': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
    'Adriano Ramos Pinto': 'https://www.ramospinto.pt/en/',
    'Ramos Pinto': 'https://www.ramospinto.pt/en/',
    'Merum Priorati': 'http://merumpriorati.com/en/',
    "Col d'Orcia": 'https://coldorcia.it/en/home',
    'Col d\'Orcia': 'https://coldorcia.it/en/home',
    'Coldorcia': 'https://coldorcia.it/en/home',
    'Brancaia': 'https://brancaia.com/en/',
    'CVNE': 'https://cvne.com/en/',
    'Tensley': 'https://tensleywines.com/',
    'Paolo Scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
    'Scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
    'Beronia': '' // Site down
  };
  
  let updatedCount = 0;
  
  // Check each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const wineryName = data[i][wineryNameCol];
    if (!wineryName) continue;
    
    const correctUrl = correctUrls[wineryName.trim()];
    const currentUrl = data[i][websiteCol] || '';
    
    if (correctUrl !== undefined && currentUrl.trim() !== correctUrl) {
      // Update the cell
      sheet.getRange(i + 1, websiteCol + 1).setValue(correctUrl);
      Logger.log('UPDATED: ' + wineryName);
      Logger.log('  From: ' + (currentUrl || '(empty)'));
      Logger.log('  To: ' + correctUrl);
      updatedCount++;
    }
  }
  
  Logger.log('\n=== SUMMARY ===');
  Logger.log('Updated ' + updatedCount + ' winery URLs');
  Logger.log('\nNext steps:');
  Logger.log('1. Go to: https://nywecontracts.winespectator.com/roster');
  Logger.log('2. Click "Sync from Google Sheets"');
  Logger.log('3. Download new QR book from /qr page');
  
  SpreadsheetApp.getUi().alert(
    'Success!',
    'Updated ' + updatedCount + ' winery URLs.\n\n' +
    'Next: Sync roster at nywecontracts.winespectator.com/roster',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 Fix URLs')
    .addItem('Fix NYWE Winery URLs', 'fixWineryUrls')
    .addToUi();
}
