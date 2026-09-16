# Quick Way to Update Google Sheet

## Option 1: Automated Script (Fastest if you have credentials)

If you have the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable set:

```bash
cd /workspace
tsx scripts/fix-google-sheet-urls.mts
```

This will automatically find and update all 11 winery URLs in the spreadsheet.

### To set up the service account key:

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

Then run:
```bash
tsx scripts/fix-google-sheet-urls.mts
```

---

## Option 2: Use Google Sheets "Find and Replace" (Very Fast)

Instead of updating each row manually, use Find and Replace:

1. Open: https://docs.google.com/spreadsheets/d/1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk/
2. Press `Ctrl+H` (or `Cmd+H` on Mac) for Find and Replace
3. Do these replacements one by one:

### Find and Replace Operations:

**1. Ca'Marcanda:**
- Find: `diamondcreekvineyards.com`
- Replace: `https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/`
- Click "Replace all"

**2. GAJA:**
- Find: `vikwine.com`
- Replace: `https://wilsondaniels.com/winery/gaja/`
- Click "Replace all"

**3. Adriano Ramos Pinto (typo fix):**
- Find: `www,ramospinto`
- Replace: `https://www.ramospinto.pt/en/`
- Click "Replace all"

**4. Merum Priorati (typo fix):**
- Find: `ventrura.com`
- Replace: `http://merumpriorati.com/en/`
- Click "Replace all"

**5. Col d'Orcia (domain fix):**
- Find: `coldorcia.com`
- Replace: `https://coldorcia.it/en/home`
- Click "Replace all"

**6. Tensley (www removal):**
- Find: `www.tensleywines.com`
- Replace: `https://tensleywines.com/`
- Click "Replace all"

Then manually update these 4 (if Find/Replace doesn't catch them):
- Pieve Santa Restituta → `https://wilsondaniels.com/winery/pieve-santa-restituta/`
- Brancaia → `https://brancaia.com/en/`
- CVNE → `https://cvne.com/en/`
- Paolo Scavino → `https://www.skurnik.com/producer/paolo-scavino/`

This should take about 2-3 minutes instead of 5.

---

## Option 3: CSV Import (Bulk Update)

Create a CSV with correct data and import it:

1. Export current sheet to CSV
2. Edit the URL column with correct values
3. Re-import to overwrite

But this is more complex than Find and Replace.

---

## Option 4: Apps Script (One-Time Setup)

I can create a Google Apps Script that runs directly in the spreadsheet:

```javascript
function fixWineryUrls() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const urlFixes = {
    'Ca\'Marcanda': 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
    'GAJA': 'https://wilsondaniels.com/winery/gaja/',
    'Pieve Santa Restituta': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
    // ... etc
  };
  
  // Find and update URLs
  // ... code ...
}
```

Would you like me to create this?

---

## Recommended: Option 2 (Find and Replace)

The Find and Replace method is the quickest manual approach - about 2-3 minutes total.

Just press `Ctrl+H` and do the 6 find/replace operations above, then manually check the remaining 4 wineries.
