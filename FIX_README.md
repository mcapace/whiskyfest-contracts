# 🎯 Big Smoke Template Fix - Start Here

> **Quick Summary**: Agua Caliente All-Access contracts were generating with the wrong template (WFNY instead of Big Smoke). This PR fixes the root cause and provides tools to prevent it from happening again.

---

## 📍 Where to Start

Choose your path based on your role:

### 👤 Just Want to Fix Agua Caliente?
→ **Read**: `AGUA_CALIENTE_FIX.md`  
→ **Time**: 10 minutes  
→ **What you'll do**: Run 3 SQL commands and test

### 👔 Need Executive Summary?
→ **Read**: `SUMMARY.md`  
→ **Time**: 3 minutes  
→ **What you'll learn**: What broke, what's fixed, what's next

### 📊 Want to See Visual Diagrams?
→ **Read**: `TEMPLATE_RESOLUTION_FLOW.md`  
→ **Time**: 5 minutes  
→ **What you'll see**: Before/after flow diagrams

### 📋 Need Complete Project Details?
→ **Read**: `ISSUES_FIXED_AND_NEXT_STEPS.md`  
→ **Time**: 10 minutes  
→ **What you'll get**: All 6 issues fixed + complete action plan

### 🛠️ Developer/Technical Deep Dive?
→ **Read**: `docs/TEMPLATE_CONFIGURATION.md`  
→ **Time**: 15 minutes  
→ **What you'll learn**: How templates work, configuration, troubleshooting

---

## 🚀 Quick Start (3 Steps)

### 1️⃣ Merge This PR
[Pull Request #2](https://github.com/mcapace/whiskyfest-contracts/pull/2)

### 2️⃣ Run the Audit
```bash
npx tsx scripts/audit-event-templates.mts
```

This shows you which events have template issues.

### 3️⃣ Fix Agua Caliente
```sql
-- Get the event ID
SELECT id, name FROM events 
WHERE name ILIKE '%Agua Caliente%' OR name ILIKE '%All-Access%';

-- Set the correct template
UPDATE events
SET google_template_doc_id = 'YOUR_TEMPLATE_DOC_ID'
WHERE id = 'YOUR_EVENT_ID';
```

**Done!** 🎉

---

## 📦 What's Included in This PR

### Code Fixes
- ✅ Fixed migration that was applying wrong template to all Big Smoke events
- ✅ Added warning logs when templates fall back to defaults
- ✅ Created cleanup migration to fix existing misconfigured events

### New Tools
- ✅ Audit script to detect template misconfigurations
- ✅ Comprehensive documentation
- ✅ Step-by-step fix guides

### Documentation
| File | What It Contains |
|------|------------------|
| 📘 `SUMMARY.md` | Executive summary |
| 📊 `TEMPLATE_RESOLUTION_FLOW.md` | Visual flow diagrams |
| 🔧 `AGUA_CALIENTE_FIX.md` | Step-by-step SQL fix |
| 📋 `ISSUES_FIXED_AND_NEXT_STEPS.md` | Complete issues + action plan |
| 🛠️ `docs/TEMPLATE_CONFIGURATION.md` | Technical guide |
| 📍 `FIX_README.md` | This file (navigation) |

---

## 🐛 What Was Wrong

**The Problem**:
```
User creates Agua Caliente contract
  → Event missing template configuration
  → System falls back to WhiskyFest template
  → ❌ Generated contract has wrong branding/terms
```

**Root Causes**:
1. Migration 073 applied Las Vegas template to ALL Big Smoke events
2. Events without proper `contract_template_profile` fell back to WhiskyFest
3. No warnings when wrong templates were used
4. No tools to detect misconfigurations

---

## ✅ What's Fixed

**After This PR**:
```
User creates Agua Caliente contract
  → Event has specific template set (after you update DB)
  → ✅ System uses correct Big Smoke template

OR (if template missing):
  → ⚠️ Warning logged for admin review
  → Falls back to Big Smoke template (not WhiskyFest)
```

**6 Issues Resolved**:
1. ✅ Fixed migration to only apply Las Vegas template to Las Vegas
2. ✅ Enhanced template resolution with proper fallback logic
3. ✅ Added audit tool to detect misconfigurations proactively
4. ✅ Created comprehensive documentation
5. ✅ Added warning logs for silent failures
6. ✅ Created cleanup migration for existing bad data

---

## 📝 Your To-Do List

After merging this PR:

- [ ] **1. Merge PR** (2 minutes)
- [ ] **2. Run audit script** (30 seconds)
  ```bash
  npx tsx scripts/audit-event-templates.mts
  ```
- [ ] **3. Fix Agua Caliente event** (5 minutes)
  - Find event ID in database
  - Get correct Google Doc template ID
  - Run UPDATE query
- [ ] **4. Test contract generation** (2 minutes)
  - Create test contract for Agua Caliente
  - Verify correct Big Smoke template
- [ ] **5. Fix other misconfigured events** (varies)
  - Based on audit script results
  - Use same SQL pattern as Agua Caliente

**Total Time**: ~10 minutes for Agua Caliente, plus additional time for any other events found by audit.

---

## 🆘 Need Help?

### Quick References
| Need | Where to Look |
|------|---------------|
| SQL commands | `AGUA_CALIENTE_FIX.md` |
| Visual explanation | `TEMPLATE_RESOLUTION_FLOW.md` |
| Executive summary | `SUMMARY.md` |
| All issues fixed | `ISSUES_FIXED_AND_NEXT_STEPS.md` |
| Technical details | `docs/TEMPLATE_CONFIGURATION.md` |
| Audit tool | `scripts/audit-event-templates.mts` |

### Common Questions

**Q: Which Google Doc ID should I use for Agua Caliente?**  
A: Either:
- Find Agua Caliente's specific template in Google Drive and copy its Doc ID from the URL
- Or if it should use the same template as Las Vegas, use: `17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8`

**Q: How do I know which events need fixing?**  
A: Run the audit script: `npx tsx scripts/audit-event-templates.mts`

**Q: Will this affect existing contracts?**  
A: No, only NEW contracts generated after the fix will use correct templates.

**Q: What if I have more Big Smoke events?**  
A: Each event should have its own `google_template_doc_id` set. See `docs/TEMPLATE_CONFIGURATION.md`

---

## 🎓 Best Practices Going Forward

**For Every New Big Smoke Event**:

```sql
-- Always set these 4 fields:
INSERT INTO events (...) VALUES (
  ...,
  'big_smoke',                    -- product_key
  'big_smoke',                    -- contract_template_profile  
  'YOUR-SPECIFIC-DOC-ID',         -- google_template_doc_id ✨ CRITICAL!
  'events_managed'                -- workflow_profile
);
```

**Never** leave `google_template_doc_id` NULL for production events!

---

## 📊 Metrics

- **Files Changed**: 8
- **Lines Added**: ~600
- **Migrations**: 2 (1 modified, 1 new)
- **New Scripts**: 1 (audit tool)
- **Documentation Files**: 5
- **Time to Fix Agua Caliente**: ~10 minutes
- **Issues Resolved**: 6

---

## 🎉 After You're Done

✅ Agua Caliente contracts will generate with correct Big Smoke template  
✅ You'll have an audit tool to catch future misconfigurations  
✅ You'll have comprehensive documentation for the team  
✅ Warning logs will alert you to template issues  
✅ Future Big Smoke events won't inherit wrong templates

---

**Ready to start?** Pick your document from the "Where to Start" section above! 👆

**Just want to fix it fast?** → `AGUA_CALIENTE_FIX.md` → 10 minutes ⚡
