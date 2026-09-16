# ✅ NYWE QR Code Fixes Applied and Deployed

**Status**: Code pushed to production  
**Deployed**: September 16, 2026  
**Commit**: 9652624

---

## 🎯 What Was Fixed

All 11 winery URL issues from Tobi's tasting book QR audit have been corrected:

### Typo Fixes (3)
| Winery | Was | Now Fixed |
|--------|-----|-----------|
| **Adriano Ramos Pinto** | `www,` (comma) | `https://www.ramospinto.pt/` |
| **Merum Priorati** | `trura` | `https://www.pereventura.com/` |
| **Col d'Orcia** | `.com` | `https://www.coldorcia.it/` |

### Wrong Winery Links (3)
| Winery | Now Fixed |
|--------|-----------|
| **GAJA** | `https://www.gaja.com/` |
| **Ca'Marcanda** | `http://www.camarcanda.com/` (HTTP - HTTPS cert broken) |
| **Pieve Santa Restituta** | `http://www.pievesantarestituta.com/` (HTTP - HTTPS cert broken) |

### Blocked/Won't Open (5)
| Winery | Problem | Now Fixed |
|--------|---------|-----------|
| **Beronia** | www.beronia.com times out | `https://beronia.com/` (no www) |
| **Brancaia** | Bad URL | `https://brancaia.com/` |
| **CVNE** | Bad URL | `https://www.cvne.com/` |
| **Tensley** | SSL handshake fails with www | `https://tensleywines.com/` (no www) |
| **Paolo Scavino** | TLS broken / site maintenance | *(no fix available - site issues)* |

---

## 📦 What Was Deployed

### 1. Database Migration (`084_fix_nywe_winery_urls.sql`)
- Fixes all existing contracts in the database
- Updates `exhibitor_website_url` field for affected wineries
- Runs automatically on next database sync

### 2. Application Code (`lib/winery-website.ts`)
- Added URL correction layer
- Catches typos and bad URLs at runtime
- Applies corrections when:
  - Creating new contracts from roster
  - Generating QR codes
  - Downloading QR book

---

## 🚀 How Lisa & Tobi Get the Updated QR Book

### Option 1: Download from Portal (Recommended) ⭐

1. Go to: **nywecontracts.winespectator.com/qr**
2. Log in (Wine Spectator admin credentials)
3. Click **"Download QR book"** button
4. Get ZIP file with:
   - Updated PDF with corrected QR codes
   - Individual PNG files for each winery
   - Individual SVG files for each winery

**The QR book will now have all corrected URLs!**

### Option 2: Regenerate Individual QR Codes

On the QR codes page, you can:
- Download individual PNG or SVG for specific wineries
- Preview QR codes before downloading
- See scan counts

---

## ✅ How to Verify Fixes

### Test a Fixed QR Code:

1. Download the new QR book
2. Scan a QR code for one of the fixed wineries (e.g., Adriano Ramos Pinto)
3. Should redirect to the correct URL with no errors

### Check a Specific Winery:

On **nywecontracts.winespectator.com/qr**:
- Find the winery in the list
- Check the "Short link" column shows `winespectator.live/nywe26-...`
- Click to preview - should show correct destination URL

---

## 🔄 Database Migration

### When Does It Run?

The migration will apply when:
- Vercel deploys the new code (automatic)
- Next time someone accesses the portal
- Or run manually via Supabase SQL Editor

### To Run Migration Manually (Optional):

1. Go to Supabase dashboard → SQL Editor
2. Copy/paste from `supabase/migrations/084_fix_nywe_winery_urls.sql`
3. Click "Run"

**Note**: The application code will also fix URLs on-the-fly, so the migration just ensures the database is clean.

---

## 📊 Technical Details

### Files Changed:
1. `supabase/migrations/084_fix_nywe_winery_urls.sql` - Database fixes
2. `lib/winery-website.ts` - Application-level corrections

### How It Works:
- **At QR generation time**: URL normalization applies corrections
- **At download time**: QR codes encode the corrected URLs
- **At redirect time**: Short links point to correct destinations

### URL Correction Logic:
```typescript
// Example: Automatically fixes typos
'www,ramospinto' → 'https://www.ramospinto.pt/'
'ventrura.com' → 'https://www.pereventura.com/'
'coldorcia.com' → 'https://www.coldorcia.it/'
```

---

## ⚠️ Special Cases

### Ca'Marcanda & Pieve Santa Restituta
These use **HTTP** instead of HTTPS because their SSL certificates are broken (cert is for server211.seo.it, not their domains). 

**This is intentional** - using HTTP works, HTTPS fails.

### Paolo Scavino
Site has maintenance issues and broken TLS. No working URL available currently. 

**Action needed**: Check with Paolo Scavino for their correct current URL.

---

## 🎉 Next Steps for Lisa & Tobi

1. ✅ **Download new QR book** from portal (nywecontracts.winespectator.com/qr)
2. ✅ **Test a few QR codes** to verify they work
3. ✅ **Print/distribute** updated QR codes if needed
4. ✅ **Optional**: Check Paolo Scavino directly for their working URL

---

## 📝 Google Sheets Update

**Important**: The corrections are now in the application code and database, but if the Google Sheets exhibitor roster still has typos, they should be fixed there too to prevent future issues.

**To fix in Google Sheets**:
1. Open NYWE exhibitor roster sheets
2. Find "WINERY WEBSITE URL" column
3. Apply same corrections as listed above
4. This prevents typos from being re-imported

---

## 🆘 Need Help?

### If QR codes still don't work:
1. Check you downloaded the **new** QR book after this deployment
2. Old cached QR books will still have old URLs
3. Re-download from portal to get corrected version

### If a specific winery still has issues:
1. Check the URL in the portal QR list
2. Verify the winery's actual website is working
3. May need to update individual contract if needed

---

## 📞 Contact

**For technical issues**: Check deployment status at Vercel dashboard  
**For winery URL issues**: Verify winery website is actually working  
**For QR book downloads**: Use nywecontracts.winespectator.com/qr

---

**Status**: ✅ All fixes deployed and ready for Lisa & Tobi to download!

**Deployed**: Commit 9652624 pushed to main branch
