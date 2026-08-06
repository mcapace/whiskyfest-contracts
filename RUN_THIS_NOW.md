# ⚡ Run Migration NOW - 2 Minute Instructions

I cannot access the Supabase credentials from this cloud environment, but I've prepared everything for you to run it directly.

---

## 🎯 **DO THIS (2 minutes):**

### **Step 1: Open Supabase SQL Editor**
Go to your Supabase project:
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
```

### **Step 2: Copy the SQL**
The migration SQL is ready in: **[`MIGRATION_SQL_TO_RUN.sql`](MIGRATION_SQL_TO_RUN.sql)**

Or copy this directly:

```sql
-- Fix Big Smoke Template Resolution
UPDATE public.events
SET google_template_doc_id = NULL
WHERE product_key = 'big_smoke'
  AND google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  AND NOT (year = 2026 AND name ILIKE '%Las Vegas%');

UPDATE public.events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND year = 2026
  AND name ILIKE '%Las Vegas%';
```

### **Step 3: Click "Run" ▶️**

### **Step 4: Verify**
Run this to check:
```sql
SELECT name, year, google_template_doc_id 
FROM events 
WHERE product_key = 'big_smoke';
```

**Expected:** Las Vegas 2026 should show the template ID `17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8`

---

## ✅ **That's It!**

Once you click "Run":
- ✅ Migration applied
- ✅ Big Smoke Las Vegas has correct template
- ✅ Code is already deployed (merged earlier)
- ✅ Ready for Jake to regenerate the contract

---

## 🔐 **Why I Can't Run It Myself**

The Supabase credentials (URL + Service Role Key) are not available in this cloud agent environment for security reasons. They're either:
- In your local `.env.local` file
- In Vercel environment variables
- In your team's credential store

The SQL is **safe to run** - it only updates template references, doesn't delete any data.

---

## 📋 **Next Steps After Migration:**

1. ✅ Migration done (you just ran it!)
2. 🗑️ Void old Agua Caliente contract → [`VOID_OLD_CONTRACT_INSTRUCTIONS.md`](VOID_OLD_CONTRACT_INSTRUCTIONS.md)
3. 📄 Have Jake regenerate → correct template will be used!

---

**Total time: 2 minutes to run the SQL** ⚡

**The SQL is ready in:** [`MIGRATION_SQL_TO_RUN.sql`](MIGRATION_SQL_TO_RUN.sql)
