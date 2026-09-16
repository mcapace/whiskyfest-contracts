# URGENT: Fix QR Code Mismatches

**Issue**: Ca'Marcanda → Diamond Creek, GAJA → VIK

**Status**: Migration ran, but QR codes still wrong

---

## Root Cause Analysis

There are TWO possible issues:

### Issue 1: Rebrandly Short Links Point to Wrong Contract IDs

The QR codes might be:
- Ca'Marcanda QR → `/b/[diamond-creek-contract-id]` instead of `/b/[camarcanda-contract-id]`
- GAJA QR → `/b/[vik-contract-id]` instead of `/b/[gaja-contract-id]`

This would happen if the slashtags got mixed up when creating the short links.

### Issue 2: Contract IDs Got Swapped

The contracts table might have:
- Ca'Marcanda contract with Diamond Creek's website URL
- GAJA contract with VIK's website URL

---

## Step 1: Diagnose the Problem

Run this script to see what's happening:

```bash
cd /workspace
tsx scripts/diagnose-qr-mismatch.mts
```

This will show:
- What's in the database for each winery
- What the Rebrandly short links point to
- Where the mismatch is

---

## Step 2: Manual Database Check

Run this SQL query:

```sql
SELECT 
  id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%Ca''Marcanda%'
   OR exhibitor_company_name ILIKE '%GAJA%'
   OR exhibitor_company_name ILIKE '%Diamond Creek%'
   OR exhibitor_company_name ILIKE '%VIK%'
ORDER BY exhibitor_company_name;
```

Look for:
1. Does Ca'Marcanda have the Wilson Daniels URL?
2. Does GAJA have the Wilson Daniels URL?
3. Or do they still have old URLs?

---

## Likely Problem: Slashtag Collision

The QR system creates slashtags like:
- `nywe26-camarcanda` for Ca'Marcanda
- `nywe26-gaja` for GAJA

If these slashtags were created in the wrong order or got mixed up, the short links point to the wrong contracts.

---

## Solution A: Update Rebrandly Destinations Directly

If the contracts have correct URLs but Rebrandly links are wrong:

1. Get Ca'Marcanda contract ID from database
2. Get GAJA contract ID from database
3. Update Rebrandly links to point to correct `/b/[contract-id]`

```sql
-- Example: Find the contract IDs
SELECT id, exhibitor_company_name 
FROM contracts 
WHERE exhibitor_company_name ILIKE '%Ca''Marcanda%';

SELECT id, exhibitor_company_name 
FROM contracts 
WHERE exhibitor_company_name ILIKE '%GAJA%'
  AND exhibitor_company_name NOT ILIKE '%Marcanda%'
  AND exhibitor_company_name NOT ILIKE '%Pieve%';
```

Then update Rebrandly (via API or the script).

---

## Solution B: Regenerate QR Short Links

If the problem is complex, regenerate the short links:

1. Delete the old rebrandly_link_id for affected contracts:

```sql
UPDATE contracts
SET rebrandly_link_id = NULL,
    rebrandly_short_url = NULL
WHERE exhibitor_company_name ILIKE '%Ca''Marcanda%'
   OR (exhibitor_company_name ILIKE '%GAJA%' 
       AND exhibitor_company_name NOT ILIKE '%Marcanda%'
       AND exhibitor_company_name NOT ILIKE '%Pieve%');
```

2. In the portal UI, go to QR codes page
3. Click "Create short links" button
4. This will create fresh Rebrandly links for these wineries
5. Re-download the QR book

---

## Solution C: Direct Rebrandly Fix (Fastest)

If you can access Rebrandly dashboard:

1. Find the short link for Ca'Marcanda (e.g., `winespectator.live/nywe26-camarcanda`)
2. Check its destination
3. If it's pointing to wrong contract ID, update it manually
4. Same for GAJA

---

## What Lisa Should See After Fix

When scanning QR codes:
- Ca'Marcanda → winespectator.live/nywe26-camarcanda → tracking page → https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/
- GAJA → winespectator.live/nywe26-gaja → tracking page → https://wilsondaniels.com/winery/gaja/

---

## Quick Test to Verify Issue

Ask Lisa for the EXACT URLs she's seeing:
1. Scan Ca'Marcanda QR code
2. Note the winespectator.live short URL (e.g., `winespectator.live/nywe26-XXXXX`)
3. Note the final destination she lands on

This will tell us if:
- The short URL itself is wrong (slashtag issue)
- The short URL is right but destination is wrong (Rebrandly mapping issue)
- The tracking redirect is wrong (database URL issue)

---

## Emergency Workaround

If you can't fix it immediately, you can:

1. Create NEW short links for Ca'Marcanda and GAJA with different slashtags:
   - `nywe26-camarcanda-fixed`
   - `nywe26-gaja-fixed`

2. Generate NEW QR codes for just these two wineries

3. Give Lisa the corrected QR codes to replace in the book

---

## Files Created

- `scripts/diagnose-qr-mismatch.mts` - Run this first to diagnose
- `scripts/update-nywe-qr-destinations.mts` - Use if Rebrandly needs bulk update

---

## Next Steps

1. Run diagnostic script: `tsx scripts/diagnose-qr-mismatch.mts`
2. Share the output
3. I'll tell you exactly which fix to apply

Or tell me:
- What URL does Lisa see when she scans Ca'Marcanda?
- What URL does Lisa see when she scans GAJA?
- What are the winespectator.live short URLs?

This will pinpoint the exact issue.
