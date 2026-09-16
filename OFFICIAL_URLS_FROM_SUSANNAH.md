# Official NYWE QR Code URLs - From Susannah Nolan

**Date**: September 16, 2026, 12:00 PM  
**Source**: Susannah Nolan via email  
**Status**: ✅ Applied to production

---

## Official URLs for NYWE Tasting Book QR Codes

These are the verified, official URLs provided by Susannah Nolan for the NYWE tasting book QR codes.

### Wilson Daniels Importer Pages (Gaja Estates)

| Winery | Official URL |
|--------|--------------|
| **Ca'Marcanda** | https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/ |
| **GAJA** | https://wilsondaniels.com/winery/gaja/ |
| **Pieve Santa Restituta** | https://wilsondaniels.com/winery/pieve-santa-restituta/ |

*Note: Wilson Daniels is the official US importer for Gaja estates. These pages provide full producer information.*

### Winery Sites (English Versions)

| Winery | Official URL |
|--------|--------------|
| **Adriano Ramos Pinto** | https://www.ramospinto.pt/en/ |
| **Merum Priorati** | http://merumpriorati.com/en/ |
| **Col d'Orcia** | https://coldorcia.it/en/home |
| **Brancaia** | https://brancaia.com/en/ |
| **CVNE** | https://cvne.com/en/ |
| **Tensley** | https://tensleywines.com/ |

### Importer Pages (When Winery Site Unavailable)

| Winery | Official URL | Notes |
|--------|--------------|-------|
| **Paolo Scavino** | https://www.skurnik.com/producer/paolo-scavino/ | Skurnik is US importer; winery site has broken TLS |

### Site Currently Down

| Winery | Status |
|--------|--------|
| **Beronia** | Site is "really and truly cooked" per Susannah - completely down |

---

## Key Differences from Initial Research

### 1. Gaja Estates → Wilson Daniels Importer Pages
- **Previously**: Tried to use direct winery sites (camarcanda.com, pievesantarestituta.com, gaja.com)
- **Issue**: Ca'Marcanda and Pieve had broken HTTPS certificates
- **Now**: Using Wilson Daniels importer pages - professional, always working, full info

### 2. English Language Versions
- **Now using `/en/` URLs** where available for better US customer experience:
  - Adriano Ramos Pinto: `/en/`
  - Merum Priorati: `/en/`
  - Col d'Orcia: `/en/home`
  - Brancaia: `/en/`
  - CVNE: `/en/`

### 3. Merum Priorati Correction
- **Previously**: Thought it was "Pere Ventura" (from typo "trura" → "tura")
- **Actually**: Merum Priorati - correct site is http://merumpriorati.com/en/

### 4. Beronia Confirmed Down
- **Previously**: Tried beronia.com
- **Now**: Confirmed by Susannah the site is completely down
- **Action**: Set to NULL in database so it can be updated when available

---

## Implementation

### Files Updated:

1. **`lib/winery-website.ts`**
   - Updated WINERY_URL_CORRECTIONS with official URLs
   - Application-level corrections for QR generation

2. **`supabase/migrations/084_fix_nywe_winery_urls.sql`**
   - Database updates with official URLs
   - Sets Beronia to NULL (site down)

### How It Works:

When generating QR codes or downloading the QR book:
1. System checks winery name
2. Applies official URL from corrections table
3. Creates QR code with correct destination
4. Tracks scans through winespectator.live short links

---

## Download Updated QR Book

**Portal**: nywecontracts.winespectator.com/qr

1. Log in
2. Click "Download QR book"
3. Get ZIP with:
   - PDF with all corrected QR codes
   - Individual PNG files
   - Individual SVG files

All QR codes now use these official URLs from Susannah!

---

## Summary of All 11 Fixes

| # | Winery | Status | Final URL |
|---|--------|--------|-----------|
| 1 | Adriano Ramos Pinto | ✅ Fixed | https://www.ramospinto.pt/en/ |
| 2 | Merum Priorati | ✅ Fixed | http://merumpriorati.com/en/ |
| 3 | Col d'Orcia | ✅ Fixed | https://coldorcia.it/en/home |
| 4 | Ca'Marcanda | ✅ Fixed | https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/ |
| 5 | GAJA | ✅ Fixed | https://wilsondaniels.com/winery/gaja/ |
| 6 | Pieve Santa Restituta | ✅ Fixed | https://wilsondaniels.com/winery/pieve-santa-restituta/ |
| 7 | Beronia | ⚠️ Site Down | (set to NULL - awaiting working URL) |
| 8 | Brancaia | ✅ Fixed | https://brancaia.com/en/ |
| 9 | CVNE | ✅ Fixed | https://cvne.com/en/ |
| 10 | Paolo Scavino | ✅ Fixed | https://www.skurnik.com/producer/paolo-scavino/ |
| 11 | Tensley | ✅ Fixed | https://tensleywines.com/ |

**10 out of 11 wineries have working QR codes**  
**1 winery (Beronia) awaiting site restoration**

---

## Deployment

**Deployed**: September 16, 2026  
**Status**: ✅ Live in production  
**Ready for**: Lisa & Tobi to download corrected QR book

---

**Source**: Susannah Nolan email, Sept 16, 2026, 12:00 PM
