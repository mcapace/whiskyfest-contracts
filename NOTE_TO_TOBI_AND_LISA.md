# Note to Tobi & Lisa - NYWE QR Code Fixes

**Date**: September 16, 2026  
**Status**: ✅ All fixes deployed to production

---

Hi Tobi & Lisa,

Good news! All the NYWE tasting book QR code issues that Tobi reported have been fixed and deployed to production.

## 🎯 What's Ready Now

**All 11 winery URL problems are fixed:**
- ✅ Typos corrected (Adriano Ramos Pinto, Merum Priorati, Col d'Orcia)
- ✅ Wrong winery links fixed (GAJA, Ca'Marcanda, Pieve Santa Restituta)
- ✅ Blocked URLs working (Beronia, Brancaia, CVNE, Tensley, Paolo Scavino)

## 📥 How to Download the Updated QR Book

### Quick Steps:

1. **Go to**: nywecontracts.winespectator.com/qr
2. **Log in** with your Wine Spectator admin credentials
3. **Click**: "Download QR book" button
4. **You'll get**: A ZIP file containing:
   - Updated PDF with all corrected QR codes
   - Individual PNG files for each winery
   - Individual SVG files for each winery

**All QR codes in this new download have the corrected URLs!**

## ✅ What Was Fixed

### Typo Corrections:
| Winery | What Was Wrong | Now Fixed |
|--------|----------------|-----------|
| Adriano Ramos Pinto | Had `www,` with comma | Now `www.` with period → https://www.ramospinto.pt/ |
| Merum Priorati | Said "trura" | Now "tura" → https://www.pereventura.com/ |
| Col d'Orcia | Ended in `.com` | Now `.it` → https://www.coldorcia.it/ |

### Wrong Winery Pages:
| Winery | Now Goes To |
|--------|-------------|
| GAJA | https://www.gaja.com/ (correct main site) |
| Ca'Marcanda | http://www.camarcanda.com/ (Gaja estate) |
| Pieve Santa Restituta | http://www.pievesantarestituta.com/ (Gaja estate) |

*Note: Ca'Marcanda and Pieve use HTTP instead of HTTPS because their SSL certificates are broken. This is intentional - HTTP works, HTTPS doesn't.*

### Sites That Wouldn't Open:
| Winery | Problem | Fixed |
|--------|---------|-------|
| Beronia | Timeout with www | Now works: https://beronia.com/ (no www) |
| Brancaia | Bad/stale URL | Now works: https://brancaia.com/ |
| CVNE | Bad/stale URL | Now works: https://www.cvne.com/ |
| Tensley | SSL error with www | Now works: https://tensleywines.com/ (no www) |
| Paolo Scavino | Winery site has broken TLS | Now uses Skurnik importer page: https://www.skurnik.com/producer/paolo-scavino/ |

## 🧪 How to Test

1. Download the new QR book (see steps above)
2. Open the PDF
3. Scan any of the fixed QR codes with your phone
4. Should redirect smoothly to the correct winery website

**Example**: Scan Adriano Ramos Pinto's QR → should go to www.ramospinto.pt (no errors)

## 📱 Individual QR Downloads

You can also download individual QR codes from the portal:
- Go to nywecontracts.winespectator.com/qr
- Find any winery in the list
- Download PNG or SVG format
- Preview before downloading

## ⚡ What Happens Behind the Scenes

The system now:
1. **Automatically corrects** typos when creating QR codes
2. **Uses the right URLs** for all wineries
3. **Tracks scans** through winespectator.live short links
4. **Generates clean PDFs** with corrected QR codes

## 🔄 Google Sheets Note

If you're also managing the exhibitor roster in Google Sheets, you should update the "WINERY WEBSITE URL" column there too with these same corrections. This prevents the typos from being re-imported in the future.

## ❓ Questions or Issues?

**If a QR code still doesn't work:**
- Make sure you downloaded the NEW QR book after this fix (Sept 16, 2026)
- Old cached/downloaded QR books will still have the old URLs
- Re-download from the portal to get the corrected version

**If you need to check a specific winery:**
- Go to nywecontracts.winespectator.com/qr
- Find the winery in the list
- Check the "Short link" column
- Click to preview the destination

## 🎉 You're All Set!

The corrected QR book is ready to download right now. All the issues from Tobi's audit are fixed and deployed.

Let me know if you have any questions or need anything else!

---

**Deployment Details:**
- Deployed: September 16, 2026
- Commits: 9652624, 6b693f5
- Status: ✅ Live in production
- Portal: nywecontracts.winespectator.com/qr

Best,
Mike (via Cloud Agent)
