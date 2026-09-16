# Explanation of QR Code Issue and Fix

## The Problem

Based on the diagnostic SQL results, here's what's wrong:

### Ca'Marcanda Issue:
- **Contract ID**: `7ac8dd90-bc91-4754-9c2c-f466c058084b`
- **Has QR code**: `winespectator.live/nywe26-ca-marcanda`
- **Current URL**: `https://diamondcreekvineyards.com/` ❌ WRONG
- **Should be**: `https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/`

### GAJA Issue - Duplicate Contracts!
There are **TWO** Gaja contracts in the database:

**Contract 1** (No QR code):
- **Contract ID**: `e98f50e1-e4d2-457e-9c26-18e9fe426e07`
- **Has QR code**: No (null)
- **Current URL**: `https://wilsondaniels.com/winery/gaja/` ✅ CORRECT
- **Problem**: This one has the right URL but no QR code!

**Contract 2** (Has QR code):
- **Contract ID**: `a7d410ad-849a-4689-a98b-0de7a8278b8e`
- **Has QR code**: `winespectator.live/nywe26-gaja` ✅
- **Current URL**: `https://www.vikwine.com/` ❌ WRONG (VIK's website!)
- **Should be**: `https://wilsondaniels.com/winery/gaja/`
- **Problem**: This one has the QR code but VIK's URL!

## Why the Migration Failed

The migration in `084_fix_nywe_winery_urls.sql` used:

```sql
WHERE exhibitor_company_name ILIKE '%GAJA%'
  AND exhibitor_company_name NOT ILIKE '%Marcanda%'
  AND exhibitor_company_name NOT ILIKE '%Pieve%'
```

When there are TWO contracts with the same name "Gaja", it updated one of them - but it updated the WRONG one (the one without a QR code).

The one WITH the QR code still has VIK's website URL.

## The Fix

Run `FIX_QR_URLS_NOW.sql` which updates the specific contract IDs:

```sql
-- Fix Ca'Marcanda (contract with QR code)
UPDATE contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/'
WHERE id = '7ac8dd90-bc91-4754-9c2c-f466c058084b';

-- Fix GAJA (contract with QR code)
UPDATE contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/winery/gaja/'
WHERE id = 'a7d410ad-849a-4689-a98b-0de7a8278b8e';
```

## After Running the Fix

Lisa should be able to:
1. Scan Ca'Marcanda QR code → Go to Wilson Daniels Ca'Marcanda page ✅
2. Scan GAJA QR code → Go to Wilson Daniels GAJA page ✅

No need to regenerate QR codes or re-download the book. The existing QR codes will work immediately after the database update.

## Why There Are Two GAJA Contracts

Possible reasons:
1. One is for a different event/year
2. One is a draft or cancelled contract
3. Duplicate entry by mistake

You may want to investigate why there are two "Gaja" contracts and potentially:
- Delete/archive the one without a QR code
- Or merge them
- Or clarify which event each belongs to

## Verification

After running the fix, run this query:

```sql
SELECT 
  id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  status,
  order_type
FROM contracts
WHERE exhibitor_company_name = 'Gaja'
ORDER BY created_at DESC;
```

Check:
- Which contract is "executed" vs "draft"
- Which one is actively being used
- Whether one should be deleted
