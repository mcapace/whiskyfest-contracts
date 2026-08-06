# 🎯 START HERE - Complete Fix for Big Smoke Template Issue

**Everything is merged, pushed, and ready to run!**

---

## ✅ What's Already Done

- ✅ Code merged to `main` branch
- ✅ Code pushed to GitHub  
- ✅ Vercel will auto-deploy (if configured)
- ✅ Migration scripts created
- ✅ Documentation complete

---

## 🚀 What You Need to Do

### **Step 1: Run the Database Migration** (2-5 minutes)

You have **4 options** - pick the easiest for you:

#### **Option A: If you have Vercel CLI access** ⭐ **EASIEST**
```bash
cd /path/to/whiskyfest-contracts
npx vercel env pull .env.local
npx tsx scripts/run-migration-083.mts
```

#### **Option B: If you have a .env.local file**
```bash
cd /path/to/whiskyfest-contracts
npx tsx scripts/run-migration-083.mts
```

#### **Option C: Use Supabase SQL Editor** ⚡ **FASTEST (2 min)**
See: [`RUN_MIGRATION_NOW.md`](RUN_MIGRATION_NOW.md)
1. Go to Supabase dashboard
2. Copy/paste SQL
3. Click "Run"

#### **Option D: Set credentials manually**
```bash
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
npx tsx scripts/run-migration-083.mts
```

**Details for all options:** [`RUN_MIGRATION_WITH_CREDENTIALS.md`](RUN_MIGRATION_WITH_CREDENTIALS.md)

---

### **Step 2: Void the Old Contract** (3 minutes)

See: [`VOID_OLD_CONTRACT_INSTRUCTIONS.md`](VOID_OLD_CONTRACT_INSTRUCTIONS.md)

1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Find Agua Caliente contract
3. Click "Void"
4. Reason: "Wrong template - regenerating with correct Big Smoke template"

---

### **Step 3: Have Jake Regenerate** (5 minutes)

Tell Jake:
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Create NEW contract for Agua Caliente
3. Generate PDF → Will now use correct Big Smoke template ✅
4. Send to client

---

## 📚 All Documentation

| File | Purpose | When to Use |
|------|---------|-------------|
| **`START_HERE.md`** | This file - quick start | Always start here |
| [`RUN_MIGRATION_WITH_CREDENTIALS.md`](RUN_MIGRATION_WITH_CREDENTIALS.md) | All credential options | If Step 1 needs help |
| [`RUN_MIGRATION_NOW.md`](RUN_MIGRATION_NOW.md) | Quick SQL for Supabase | Option C in Step 1 |
| [`VOID_OLD_CONTRACT_INSTRUCTIONS.md`](VOID_OLD_CONTRACT_INSTRUCTIONS.md) | How to void contract | Step 2 |
| [`REAL_FIX_SUMMARY.md`](REAL_FIX_SUMMARY.md) | What happened & why | Understanding the issue |
| [`COMPLETE_REMOTE_FIX_GUIDE.md`](COMPLETE_REMOTE_FIX_GUIDE.md) | Full remote guide | Complete reference |

---

## 🔍 Quick Status Check

### Is the code deployed?
```bash
git log --oneline -3
# Should show: "Add executable migration script and credential instructions"
```

### Is Vercel deploying?
Check: https://vercel.com/your-org/whiskyfest-contracts/deployments

### Has the migration run?
Check Supabase:
```sql
SELECT name, year, google_template_doc_id 
FROM events 
WHERE product_key = 'big_smoke';
```
**Las Vegas 2026** should have template ID: `17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8`

---

## ⚡ Fastest Path (5 minutes total)

1. **Run migration via Supabase SQL** (2 min) → [`RUN_MIGRATION_NOW.md`](RUN_MIGRATION_NOW.md)
2. **Void contract via portal UI** (2 min) → [`VOID_OLD_CONTRACT_INSTRUCTIONS.md`](VOID_OLD_CONTRACT_INSTRUCTIONS.md)
3. **Have Jake regenerate** (1 min to request)

**Done!** ✅

---

## 🆘 Need Help?

- **Can't find credentials?** → [`RUN_MIGRATION_WITH_CREDENTIALS.md`](RUN_MIGRATION_WITH_CREDENTIALS.md) lists all locations
- **Don't have Vercel access?** → Use Option C (Supabase SQL) - fastest anyway!
- **Migration script errors?** → Use Supabase SQL Editor instead (Option C)
- **Can't void contract?** → Ask admin to void it for you

---

## ✅ How to Know You're Done

You'll know the fix is complete when:
- ✅ Migration script shows "Migration 083 applied successfully!"
  OR you ran the SQL in Supabase and it completed
- ✅ Old Agua Caliente contract status shows "voided"
- ✅ Jake's new Agua Caliente contract PDF shows Big Smoke branding (not WFNY)
- ✅ Client receives correct Big Smoke contract

---

## 🎉 Summary

**What's fixed:**
- Big Smoke contracts → Big Smoke templates ✅
- WhiskyFest contracts → WhiskyFest templates ✅  
- Wine Spectator contracts → Wine Spectator templates ✅

**Your action items:**
1. Run migration (one of 4 ways)
2. Void old contract
3. Jake regenerates

**Total time: 10-15 minutes**

---

**Ready? Go to Step 1 above and pick your easiest option!** 🚀
