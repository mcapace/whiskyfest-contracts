# Fix for Lisa's QR Code Issue

**Problem**: Ca'Marcanda linking to Diamond Creek, GAJA linking to VIK

**Root Cause**: The database migration `084_fix_nywe_winery_urls.sql` hasn't been applied yet to production database.

---

## What's Happening

1. QR codes → winespectator.live short links (Rebrandly)
2. Short links → Our tracking page `/b/[contractId]`
3. Tracking page → `exhibitor_website_url` from database
4. **Issue**: Database still has OLD URLs, not the new ones from migration

---

## Solution: Apply Database Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the file: `supabase/migrations/084_fix_nywe_winery_urls.sql`
5. Copy the entire SQL content
6. Paste into SQL Editor
7. Click **Run**

### Option 2: Via Supabase CLI

```bash
cd /workspace
supabase db push
```

This will apply all pending migrations including 084.

### Option 3: Via Direct SQL (If you have database credentials)

Run the SQL from `084_fix_nywe_winery_urls.sql` directly against the production database.

---

## What the Migration Does

Updates `contracts.exhibitor_website_url` for these wineries:

```sql
-- Ca'Marcanda
UPDATE public.contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/'
WHERE exhibitor_company_name ILIKE '%Ca''Marcanda%'...

-- GAJA
UPDATE public.contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/winery/gaja/'
WHERE exhibitor_company_name ILIKE '%GAJA%'...

-- And 9 other wineries...
```

---

## After Migration Runs

1. QR codes will immediately work correctly
2. No need to regenerate QR codes
3. No need to re-download QR book
4. The existing QR codes will redirect to the new URLs

---

## To Verify It Worked

### Check in Database:

```sql
SELECT 
  exhibitor_company_name,
  exhibitor_website_url
FROM contracts
WHERE exhibitor_company_name ILIKE '%Ca''Marcanda%'
   OR exhibitor_company_name ILIKE '%GAJA%'
ORDER BY exhibitor_company_name;
```

Should show:
- Ca'Marcanda → https://wilsondaniels.com/wine/ca-marcanda/...
- GAJA → https://wilsondaniels.com/winery/gaja/

### Test QR Codes:

Have Lisa scan Ca'Marcanda and GAJA QR codes again - should go to Wilson Daniels pages now.

---

## Why This Happened

The code was pushed to production, but database migrations need to be manually applied to the production database. The migration file exists in the repo but hasn't been executed against the database yet.

---

## Quick Test Before Migration

You can check if migration is needed by querying the database:

```sql
SELECT exhibitor_company_name, exhibitor_website_url
FROM contracts
WHERE exhibitor_company_name ILIKE '%Marcanda%';
```

If it shows something like:
- `http://www.diamondcreekvineyards.com/` or old URL → Migration NOT applied yet
- `https://wilsondaniels.com/wine/ca-marcanda/...` → Migration already applied

---

## After You Apply the Migration

1. Tell Lisa to try scanning the QR codes again
2. Clear browser cache if needed
3. QR codes should now work correctly without re-downloading

---

## If You Don't Have Database Access

Let me know and I can provide:
1. API endpoint to bulk update the URLs
2. Portal UI button to refresh QR destinations
3. Alternative approach

---

**Bottom line**: The fix is ready in the code and migration file, but the migration needs to be applied to the production database for the QR codes to work correctly.
