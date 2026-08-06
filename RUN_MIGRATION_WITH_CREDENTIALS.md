# 🔐 Run Migration 083 with Your Credentials

You mentioned the credentials are already in the file/code. Here are all the ways to run the migration:

---

## Option 1: Using Vercel CLI (Recommended) ⭐

If you have Vercel access:

```bash
# Navigate to the project
cd /path/to/whiskyfest-contracts

# Pull environment variables from Vercel
npx vercel env pull .env.local

# Run the migration script
npx tsx scripts/run-migration-083.mts
```

This will:
1. Download all production env vars from Vercel to `.env.local`
2. Run the migration using those credentials
3. Show before/after results

---

## Option 2: Using Existing .env File

If you already have a `.env` or `.env.local` file with credentials:

```bash
# Make sure it has these variables:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the migration
npx tsx scripts/run-migration-083.mts
```

---

## Option 3: Set Credentials Temporarily

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

npx tsx scripts/run-migration-083.mts
```

---

## Option 4: Direct Supabase SQL (Fastest - 2 minutes)

If the above don't work, use Supabase dashboard:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

2. Paste this SQL:

```sql
-- Clear Las Vegas template from non-Las Vegas Big Smoke events
UPDATE public.events
SET google_template_doc_id = NULL
WHERE product_key = 'big_smoke'
  AND google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  AND NOT (year = 2026 AND name ILIKE '%Las Vegas%');

-- Ensure Las Vegas 2026 has the correct template
UPDATE public.events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND year = 2026
  AND name ILIKE '%Las Vegas%';
```

3. Click "Run" ▶️

---

## Where Are the Credentials?

Common locations:
- `.env.local` (local development)
- `.env` (sometimes used)
- Vercel dashboard → Your Project → Settings → Environment Variables
- 1Password / credential store
- `.vercel/project.json` (has project ID)

---

## What the Script Does

The migration script (`scripts/run-migration-083.mts`):
1. ✅ Connects to Supabase using your credentials
2. ✅ Shows Big Smoke events BEFORE changes
3. ✅ Clears wrong template from non-Las Vegas events
4. ✅ Sets correct template for Las Vegas 2026
5. ✅ Shows Big Smoke events AFTER changes
6. ✅ Confirms success

**Safe to run** - only updates template references, doesn't delete data.

---

## Troubleshooting

### "Missing SUPABASE env vars"
→ Credentials not found. Try Option 1 (Vercel CLI) or Option 4 (SQL directly)

### "Connection refused"
→ Check Supabase URL is correct

### "Permission denied"
→ Make sure you're using the SERVICE_ROLE_KEY (not the anon key)

---

## After Running

Once the migration completes:
1. ✅ Big Smoke Las Vegas → has correct template
2. ✅ Code is already deployed (merged to main)
3. 🗑️ Void old Agua Caliente contract
4. 📄 Have Jake regenerate → correct template will be used

---

## Quick Check: Do You Have Vercel Access?

Run this to see if you're logged in:
```bash
npx vercel whoami
```

If you see your email → Use Option 1  
If you see "Not logged in" → Use Option 4 (SQL directly)

---

**Fastest method: Option 4 (Supabase SQL Editor) - 2 minutes** ⚡
