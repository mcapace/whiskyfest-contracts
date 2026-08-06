# 🔧 Big Smoke Template Fix - Complete Summary

## 📋 Quick Overview

**Problem**: Agua Caliente All-Access reception contracts were generating with WFNY (WhiskyFest) template instead of Big Smoke template.

**Pull Request**: [#2 - Fix Big Smoke contract template resolution](https://github.com/mcapace/whiskyfest-contracts/pull/2)

**Status**: ✅ Code fixes complete, awaiting merge. Database updates required after merge.

---

## 🐛 6 Issues Fixed

| # | Issue | Impact | Fixed By |
|---|-------|--------|----------|
| 1 | Migration 073 applied LV template to ALL Big Smoke events | Non-LV events got wrong template | Updated migration 073 |
| 2 | Missing template profile caused WhiskyFest fallback | Agua Caliente got WFNY template | Enhanced template logic + warnings |
| 3 | No tooling to detect misconfigurations | Issues only found when generating contracts | Created audit script |
| 4 | No documentation on template configuration | Easy to misconfigure new events | Created comprehensive docs |
| 5 | Silent fallbacks - no warnings | Wrong templates used without alerting | Added console.warn logs |
| 6 | Existing events with wrong templates | Old misconfigurations persisted | Created migration 083 cleanup |

---

## 📁 Files in This PR

### Database Migrations
```
supabase/migrations/
├── 073_big_smoke_template_doc.sql         [MODIFIED] Now LV-specific only
└── 083_fix_big_smoke_template_specificity.sql  [NEW] Cleanup migration
```

### Code Changes
```
lib/
└── contract-template.ts                   [MODIFIED] Added validation + warnings
```

### New Tooling
```
scripts/
└── audit-event-templates.mts              [NEW] Audit misconfigured events
```

### Documentation
```
docs/
└── TEMPLATE_CONFIGURATION.md              [NEW] Complete template guide

Root:
├── AGUA_CALIENTE_FIX.md                   [NEW] Step-by-step fix for Agua Caliente
├── ISSUES_FIXED_AND_NEXT_STEPS.md         [NEW] Complete issues + action plan
└── SUMMARY.md                             [NEW] This file
```

---

## ✅ What You Need to Do

### Step 1: Merge the PR ⚡ **DO FIRST**
```bash
# Review and merge:
https://github.com/mcapace/whiskyfest-contracts/pull/2
```

### Step 2: Run the Audit 🔍
```bash
npx tsx scripts/audit-event-templates.mts
```
This will show all events with template configuration issues.

### Step 3: Fix Agua Caliente Event 🔧
```sql
-- A. Find the event ID
SELECT id, name, google_template_doc_id 
FROM events
WHERE name ILIKE '%Agua Caliente%' OR name ILIKE '%All-Access%';

-- B. Get the template Doc ID
-- Option 1: If Agua Caliente has its own template
--   → Open the Google Doc and copy ID from URL
-- Option 2: If it uses Las Vegas template
--   → Use: 17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8

-- C. Update the event
UPDATE events
SET 
  google_template_doc_id = 'YOUR_TEMPLATE_DOC_ID',  -- from B
  contract_template_profile = 'big_smoke',
  product_key = 'big_smoke'
WHERE id = 'YOUR_EVENT_ID';  -- from A
```

### Step 4: Test It ✔️
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Create a test contract for Agua Caliente
3. Generate PDF
4. ✅ Verify it uses Big Smoke template (not WFNY!)

### Step 5: Fix Other Events (If Any) 🔧
Based on audit results, fix any other misconfigured events using the same SQL pattern.

---

## 📊 Before vs After

### BEFORE (Broken) ❌
```
User creates contract for "Agua Caliente - All-Access"
    ↓
Event missing google_template_doc_id
    ↓
Event missing/wrong contract_template_profile
    ↓
Falls back to GOOGLE_TEMPLATE_DOC_ID
    ↓
❌ Generates WFNY (WhiskyFest) template
```

### AFTER (Fixed) ✅
```
User creates contract for "Agua Caliente - All-Access"
    ↓
Event has google_template_doc_id set
    ↓
✅ Generates correct Big Smoke template for Agua Caliente

OR (if template missing):
    ↓
⚠️ Warning logged: "Big Smoke event missing template"
    ↓
Falls back to Big Smoke template (not WFNY)
```

---

## 🎯 Key Takeaways

### For Future Events
**Always set these 4 fields for Big Smoke events:**
1. ✅ `product_key = 'big_smoke'`
2. ✅ `contract_template_profile = 'big_smoke'`
3. ✅ `google_template_doc_id = 'YOUR_DOC_ID'` ← **CRITICAL!**
4. ✅ `workflow_profile = 'events_managed'`

### Monitoring
- Watch logs for: `[resolveContractTemplateDocId]` warnings
- Run audit quarterly: `npx tsx scripts/audit-event-templates.mts`
- Check template config before launching new events

### Documentation
- **Template Guide**: `docs/TEMPLATE_CONFIGURATION.md`
- **Agua Caliente Fix**: `AGUA_CALIENTE_FIX.md`
- **Complete Details**: `ISSUES_FIXED_AND_NEXT_STEPS.md`

---

## 🆘 Quick Reference

| Need | Command/Link |
|------|--------------|
| View PR | https://github.com/mcapace/whiskyfest-contracts/pull/2 |
| Audit events | `npx tsx scripts/audit-event-templates.mts` |
| Template docs | `docs/TEMPLATE_CONFIGURATION.md` |
| Fix steps | `AGUA_CALIENTE_FIX.md` |
| Full details | `ISSUES_FIXED_AND_NEXT_STEPS.md` |

---

## ⏱️ Time Estimate

- Merge PR: **2 minutes**
- Run audit: **30 seconds**
- Fix Agua Caliente: **5 minutes**
- Test contract: **2 minutes**
- **Total: ~10 minutes** ⚡

---

**Questions?** Check the documentation files in this PR or the code comments in `lib/contract-template.ts`.
