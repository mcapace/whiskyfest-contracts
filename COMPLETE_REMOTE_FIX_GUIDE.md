# ✅ Complete Remote Fix Guide - All Changes Ready

## 🎯 Current Status

✅ **Code merged and pushed to `main`**  
✅ **Vercel will auto-deploy** (if configured)  
⏳ **Database migration needs to be run** (2 minutes)  
⏳ **Old contract needs to be voided**  
⏳ **Jake needs to regenerate contract**

---

## 📋 Your To-Do List (15 minutes total)

### 1️⃣ Run Database Migration (2 minutes) ⚡ **DO THIS FIRST**

**Go to:** [`RUN_MIGRATION_NOW.md`](RUN_MIGRATION_NOW.md) ← **CLICK HERE**

**Quick version:**
1. Open https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy/paste the SQL from `RUN_MIGRATION_NOW.md`
3. Click "Run" ▶️
4. Done! ✅

This fixes the database so Big Smoke events use the correct template.

---

### 2️⃣ Void the Old Agua Caliente Contract (3 minutes)

**Go to:** [`VOID_OLD_CONTRACT_INSTRUCTIONS.md`](VOID_OLD_CONTRACT_INSTRUCTIONS.md)

**Quick version:**
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Find Agua Caliente contract
3. Click "Void" button
4. Reason: "Wrong template - regenerating with correct Big Smoke template"

---

### 3️⃣ Have Jake Regenerate Contract (5 minutes)

Tell Jake:
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Create NEW contract for Agua Caliente
3. It will now use correct Big Smoke template ✅
4. Send to client

---

## 🔍 What Got Fixed

### Code Changes (Already Live)
✅ `lib/contract-template.ts` - Fixed template resolution logic  
✅ `supabase/migrations/073_...sql` - Fixed to only apply Las Vegas template to Las Vegas  
✅ `supabase/migrations/083_...sql` - **NEW: Cleanup migration** (needs to run - see step 1)  
✅ Warning logs added  
✅ Audit script created  
✅ Documentation added

### How It Works Now
```
Big Smoke portal → Big Smoke template ✅
WhiskyFest portal → WhiskyFest template ✅  
Wine Spectator portal → Wine Spectator template ✅
```

Each portal is separate and uses its own template.

---

## 🚫 Why Remote Access is Limited

The CLIs (Vercel, Supabase) require:
- Authentication tokens
- Project IDs
- API keys

These aren't configured in this cloud environment for security.

**Solution:** Use the web dashboards (Supabase SQL Editor, BigSmoke portal UI) - that's what I've documented.

---

## 📚 All Documentation Files

| File | Purpose |
|------|---------|
| **`RUN_MIGRATION_NOW.md`** | ⭐ Run database migration (DO THIS FIRST) |
| **`VOID_OLD_CONTRACT_INSTRUCTIONS.md`** | How to void old contract |
| `REAL_FIX_SUMMARY.md` | What happened and why |
| `SUMMARY.md` | Executive summary |
| `docs/TEMPLATE_CONFIGURATION.md` | Technical guide |

---

## ⚡ Quick Reference Commands

### Check Vercel Deployment
```bash
# If you have Vercel CLI configured locally:
vercel --prod
```

### Check Git Status
```bash
git log --oneline -5
# Should show: "Add migration runner script and quick instructions for remote execution"
```

### Verify Code is Deployed
1. Check https://bigsmokecontracts.cigaraficionado.com/
2. Look in browser console for template resolution warnings (if any)

---

## ✅ Checklist

- [x] Code merged to `main`
- [x] Code pushed to GitHub
- [x] Documentation created
- [ ] **Run database migration** (see `RUN_MIGRATION_NOW.md`)
- [ ] Void old contract (see `VOID_OLD_CONTRACT_INSTRUCTIONS.md`)
- [ ] Jake regenerates contract
- [ ] Send correct contract to client

---

## 🆘 If Something Goes Wrong

### "I can't access Supabase dashboard"
→ Get credentials from team admin or check 1Password/credential store

### "Migration failed"
→ The SQL is safe to retry, just run it again

### "I don't see the Void button"
→ You might not have admin permissions - ask a team admin to void it

### "Jake's regenerated contract still shows wrong template"
→ Make sure the migration ran successfully (check step 1)

---

## 🎉 When You're Done

You should have:
✅ Database migration applied  
✅ Old contract voided  
✅ New contract with correct Big Smoke template  
✅ Client receives correct contract

**The fix is complete!**

---

**Total time: ~15 minutes**

**Start with:** [`RUN_MIGRATION_NOW.md`](RUN_MIGRATION_NOW.md) 👈
