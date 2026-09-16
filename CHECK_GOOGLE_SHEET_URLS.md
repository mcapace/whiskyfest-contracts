# Google Sheets is the Source of Truth

## You're Right!

The system syncs exhibitor website URLs from the Google Sheets exhibitor roster. 

From `lib/nywe-roster-contract-sync.ts`:
```typescript
const website = rosterWineryWebsiteUrl(row);
if (website) {
  patch.exhibitor_website_url = website;
}
```

This means the URLs in the spreadsheet need to be fixed, not just the database.

## The Real Problem

The Google Sheet you shared (https://docs.google.com/spreadsheets/d/1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk/) likely has:

- **Ca'Marcanda**: Still has Diamond Creek URL in the sheet
- **GAJA**: Still has VIK URL in the sheet

When the roster sync runs (automatically or manually), it overwrites the database with what's in the sheet!

## The Fix - Two Steps Required

### Step 1: Fix the Google Sheet URLs

In the NYWE exhibitor roster spreadsheet, find and update:

**Ca'Marcanda row:**
- Column: "WINERY WEBSITE URL *" (or similar website column)
- Change from: `https://diamondcreekvineyards.com/`
- Change to: `https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/`

**GAJA row:**
- Column: "WINERY WEBSITE URL *"
- Change from: `https://www.vikwine.com/`
- Change to: `https://wilsondaniels.com/winery/gaja/`

### Step 2: Run Roster Sync

After fixing the Google Sheet, you need to sync it to the database:

**Option A: Via Portal UI**
1. Go to: nywecontracts.winespectator.com/roster
2. Click "Sync from Google Sheets" or similar button

**Option B: Via API endpoint**
```bash
curl -X POST https://nywecontracts.winespectator.com/api/admin/nywe-roster-sync
```

**Option C: Wait for automatic sync**
- The system has a cron job that syncs periodically
- Check `/app/api/cron/nywe-roster-sync/route.ts`

## Why Your SQL Fix Won't Last

If you only fix the database without fixing the Google Sheet:
1. You run the SQL fix → Database is correct ✅
2. Lisa tests → QR codes work ✅
3. Later, roster sync runs → Overwrites database with sheet values ❌
4. QR codes break again ❌

## Check What's in the Sheet Now

Can you check the Google Sheet and see what URLs are in these rows:
- Ca'Marcanda
- GAJA

They probably still have the wrong URLs (Diamond Creek and VIK).

## All Wineries to Fix in Sheet

From Susannah's email, these should ALL be in the Google Sheet:

| Winery | Correct URL in Sheet |
|--------|---------------------|
| Ca'Marcanda | https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/ |
| GAJA | https://wilsondaniels.com/winery/gaja/ |
| Pieve Santa Restituta | https://wilsondaniels.com/winery/pieve-santa-restituta/ |
| Adriano Ramos Pinto | https://www.ramospinto.pt/en/ |
| Merum Priorati | http://merumpriorati.com/en/ |
| Col d'Orcia | https://coldorcia.it/en/home |
| Brancaia | https://brancaia.com/en/ |
| CVNE | https://cvne.com/en/ |
| Tensley | https://tensleywines.com/ |
| Paolo Scavino | https://www.skurnik.com/producer/paolo-scavino/ |
| Beronia | (site down - leave blank or use importer when available) |

## Complete Fix Process

1. ✅ Update Google Sheet with correct URLs (all 11 wineries)
2. ✅ Run roster sync to push sheet → database
3. ✅ QR codes will work correctly
4. ✅ Future syncs will maintain correct URLs

---

**Bottom line**: Fix the Google Sheet first, then sync. The database will follow.
