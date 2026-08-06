# 🚀 Run Migration 083 NOW - Simple Instructions

Since you're remote and the CLIs need credentials, here's the **fastest way** to apply the database fix:

---

## ⚡ Quick Method: Supabase Dashboard (2 minutes)

### Step 1: Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

(Replace `YOUR_PROJECT` with your actual Supabase project ID)

### Step 2: Copy and Paste This SQL

```sql
-- Migration 083: Fix Big Smoke template resolution
-- This clears the Las Vegas template from non-Las Vegas Big Smoke events

-- Clear the template doc ID for Big Smoke events that aren't Las Vegas 2026
UPDATE public.events
SET google_template_doc_id = NULL
WHERE product_key = 'big_smoke'
  AND google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  AND NOT (year = 2026 AND name ILIKE '%Las Vegas%');

-- Ensure Las Vegas 2026 specifically has the correct template
UPDATE public.events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND year = 2026
  AND name ILIKE '%Las Vegas%'
  AND (
    google_template_doc_id IS NULL
    OR TRIM(google_template_doc_id) = ''
    OR google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  );
```

### Step 3: Click "Run" ▶️

### Step 4: Verify (Optional)
Run this to check the results:
```sql
SELECT 
  id,
  name,
  year,
  product_key,
  contract_template_profile,
  google_template_doc_id
FROM events
WHERE product_key = 'big_smoke'
ORDER BY year DESC, name;
```

**Expected result:**
- Las Vegas 2026 should have `google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'`
- Other Big Smoke events (if any) should have `google_template_doc_id = NULL`

---

## ✅ That's It!

Once this runs:
1. ✅ Migration 083 is applied
2. ✅ Big Smoke Las Vegas has the correct template
3. ✅ The code fix from the merge will now work correctly
4. ✅ Jake can regenerate the Agua Caliente contract with the correct template

---

## 🔄 Alternative: Vercel Deployment

The migration files are in `/supabase/migrations/` but Vercel doesn't auto-run migrations.

**If you use a migration tool**, the migration will be picked up automatically:
- Migration file: `supabase/migrations/083_fix_big_smoke_template_specificity.sql`
- Already in the repo and pushed to `main`

---

## 📝 After Running the Migration

**Next steps:**
1. ✅ Migration applied
2. 🗑️ Void old Agua Caliente contract (see `VOID_OLD_CONTRACT_INSTRUCTIONS.md`)
3. 📄 Have Jake regenerate → correct Big Smoke template will be used
4. ✉️ Send correct contract to client

---

## ⏱️ Time to Complete

**Total: 2 minutes**
- Open Supabase dashboard: 30 seconds
- Copy/paste SQL: 30 seconds  
- Run and verify: 1 minute

---

## 🆘 If You Need Help

The SQL is safe to run - it only:
- Clears wrong template IDs from non-Las Vegas events
- Ensures Las Vegas has the correct template
- No data is deleted, just template references updated

**This is the final step to fix the template issue!**
