# Complete QR Book Fix - Step by Step Checklist

## The Problem
The Google Sheet (source of truth) has wrong URLs → Database has wrong URLs → QR codes redirect to wrong places

## The Solution
Fix Google Sheet → Sync to Database → Download new QR book → Give to Lisa

---

## Step 1: Fix Google Sheet URLs ✓

Open: https://docs.google.com/spreadsheets/d/1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk/

Find the "WINERY WEBSITE URL *" column and update these 11 rows:

### Wilson Daniels Importer Pages (3 Gaja estates):
- [ ] **Ca'Marcanda** → `https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/`
- [ ] **GAJA** → `https://wilsondaniels.com/winery/gaja/`
- [ ] **Pieve Santa Restituta** → `https://wilsondaniels.com/winery/pieve-santa-restituta/`

### Winery Sites with English Versions:
- [ ] **Adriano Ramos Pinto** → `https://www.ramospinto.pt/en/`
- [ ] **Merum Priorati** → `http://merumpriorati.com/en/`
- [ ] **Col d'Orcia** → `https://coldorcia.it/en/home`
- [ ] **Brancaia** → `https://brancaia.com/en/`
- [ ] **CVNE** → `https://cvne.com/en/`
- [ ] **Tensley** → `https://tensleywines.com/`

### Importer Pages:
- [ ] **Paolo Scavino** → `https://www.skurnik.com/producer/paolo-scavino/`

### Site Down:
- [ ] **Beronia** → Leave blank (site is down per Susannah)

**Save the sheet** (auto-saves as you edit)

---

## Step 2: Sync Sheet to Database ✓

Go to: https://nywecontracts.winespectator.com/roster

- [ ] Click "Sync from Google Sheets" or "Refresh" button
- [ ] Wait for sync to complete (should show success message)

This pushes the correct URLs from Sheet → Database

---

## Step 3: Download New QR Book ✓

Go to: https://nywecontracts.winespectator.com/qr

- [ ] Click "Download QR book" button
- [ ] Get ZIP file with:
  - PDF with all QR codes
  - Individual PNG files
  - Individual SVG files

**This is the CORRECTED QR book with proper URLs**

---

## Step 4: Verify with Lisa ✓

Give Lisa the new QR book and ask her to test these:

- [ ] Ca'Marcanda → Should go to Wilson Daniels
- [ ] GAJA → Should go to Wilson Daniels
- [ ] Pieve Santa Restituta → Should go to Wilson Daniels
- [ ] Adriano Ramos Pinto → Should go to ramospinto.pt/en/
- [ ] Any other winery → Should go to correct URL

---

## Why This Order Matters

1. **Google Sheet** = Source of truth
2. **Roster Sync** = Pushes Sheet → Database
3. **QR Book Download** = Generates QR codes from current Database URLs
4. **Old QR book** = Has old URLs, won't work

If you skip Step 1 (fixing the sheet), the roster sync will keep overwriting the database with wrong URLs.

---

## Quick Verification Before Giving to Lisa

After downloading the new QR book, you can verify by:

1. Open the PDF
2. Pick a QR code (e.g., Ca'Marcanda)
3. Scan it with your phone
4. Should go to Wilson Daniels page

If it still goes to the wrong place, the sheet wasn't synced properly.

---

## If Issues Persist

If after doing all steps Lisa still sees wrong URLs:

1. Check the database directly for the winery
2. See if there are duplicate contracts (like we found with GAJA)
3. Make sure you're downloading the QR book AFTER the sync

---

## Summary

✅ Fix all 11 winery URLs in Google Sheet  
✅ Sync Sheet → Database via portal  
✅ Download new QR book from portal  
✅ Give new QR book to Lisa  
✅ Old QR book is now obsolete  

**The new QR book will have all correct URLs from Susannah's email.**
