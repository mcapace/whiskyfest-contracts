# Information Needed from Lisa to Fix QR Codes

Hi Lisa,

To fix the QR code issue, I need you to provide the following information when you scan the QR codes:

---

## For Ca'Marcanda QR Code:

When you scan the Ca'Marcanda QR code:

1. **What is the short URL you see?**
   - Example: `winespectator.live/nywe26-camarcanda`
   - Or: `winespectator.live/nywe26-XXXXX`

2. **What is the final destination you land on?**
   - You said Diamond Creek - what's the full URL?
   - Example: `http://www.diamondcreekvineyards.com/`

---

## For GAJA QR Code:

When you scan the GAJA QR code:

1. **What is the short URL you see?**
   - Example: `winespectator.live/nywe26-gaja`
   - Or: `winespectator.live/nywe26-XXXXX`

2. **What is the final destination you land on?**
   - You said VIK - what's the full URL?
   - Example: `https://www.vik.cl/`

---

## Why I Need This:

The QR codes go through multiple redirects:

```
QR Code 
  → winespectator.live/nywe26-XXXXX (Rebrandly short link)
  → nywecontracts.winespectator.com/b/[contract-id] (Our tracking page)
  → Final winery website
```

By knowing the short URLs and final destinations, I can pinpoint exactly where the mapping is wrong:
- Are the QR codes themselves wrong (wrong slashtag)?
- Are the Rebrandly links pointing to wrong contract IDs?
- Are the contract IDs mapped to wrong websites in database?

---

## How to Get This Info:

1. Scan Ca'Marcanda QR code with your phone
2. **Before it redirects**, note the `winespectator.live/...` URL
3. Let it redirect and note the final destination
4. Repeat for GAJA

Or if the redirect is too fast:
1. Scan the QR code
2. Once you land on the wrong page, tap the address bar
3. Send me the full URL you see

---

## Quick Alternative:

If getting the URLs is difficult, can you:
1. Take a screenshot of the Ca'Marcanda QR code from the PDF
2. Take a screenshot of the GAJA QR code from the PDF
3. Send them to me

I can decode the QR codes and see what URLs they contain.

---

Once I have this information, I can create the exact fix needed.

Thanks!
Mike
