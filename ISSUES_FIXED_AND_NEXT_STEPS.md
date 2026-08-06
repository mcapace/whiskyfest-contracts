# Issues Fixed & What's Next

## Issues Fixed ✅

### 1. **Wrong Template for Non-Las Vegas Big Smoke Events**
- **Problem**: Migration 073 was applying the Las Vegas Big Smoke template to ALL Big Smoke events with missing `google_template_doc_id`
- **Impact**: Events like Agua Caliente All-Access reception would incorrectly inherit the Las Vegas template
- **Fix**: Updated migration 073 to only apply Las Vegas template specifically to Las Vegas events
- **File**: `supabase/migrations/073_big_smoke_template_doc.sql`

### 2. **WhiskyFest Template Used for Big Smoke Contracts**
- **Problem**: When Big Smoke events had incorrect or missing `contract_template_profile`, contracts would fall back to WhiskyFest (WFNY) template
- **Impact**: Agua Caliente contract generation showed WFNY branding and terms instead of Big Smoke
- **Fix**: Added validation logic and warning logs to catch template profile mismatches
- **File**: `lib/contract-template.ts`

### 3. **No Way to Detect Misconfigured Events**
- **Problem**: No tooling existed to identify events with missing or incorrect template configurations
- **Impact**: Template issues would only be discovered when generating contracts (too late)
- **Fix**: Created audit script to proactively identify misconfigured events
- **File**: `scripts/audit-event-templates.mts`

### 4. **Lack of Documentation on Template Configuration**
- **Problem**: No clear documentation on how templates are resolved or how to configure events
- **Impact**: Easy to misconfigure new events and repeat the same mistakes
- **Fix**: Created comprehensive documentation with examples and troubleshooting
- **File**: `docs/TEMPLATE_CONFIGURATION.md`

### 5. **Silent Template Fallbacks**
- **Problem**: When events used fallback templates, there were no warnings or logs
- **Impact**: Incorrect templates could be used without anyone knowing
- **Fix**: Added console.warn logs when falling back to default templates
- **File**: `lib/contract-template.ts`

### 6. **Existing Non-Las Vegas Events with Wrong Template**
- **Problem**: Any existing Big Smoke events that got the Las Vegas template from migration 073
- **Impact**: Those events would continue using the wrong template
- **Fix**: Created migration 083 to clear incorrect template assignments
- **File**: `supabase/migrations/083_fix_big_smoke_template_specificity.sql`

---

## What's Next 🚀

### Immediate Actions (After PR Merge)

#### 1. **Merge the Pull Request**
```bash
# Review and merge PR #2
https://github.com/mcapace/whiskyfest-contracts/pull/2
```

#### 2. **Apply Database Migrations**
The migrations will run automatically when deployed, but verify:
```bash
# Migration 083 will:
# - Clear Las Vegas template from non-Las Vegas Big Smoke events
# - Ensure only Las Vegas 2026 has the Las Vegas template
```

#### 3. **Run the Event Audit**
Identify all misconfigured events:
```bash
npx tsx scripts/audit-event-templates.mts
```

This will show:
- Big Smoke events missing templates ❌
- Events with mismatched product_key and template_profile ⚠️
- Events relying on fallback templates ℹ️

#### 4. **Fix the Agua Caliente Event**
Based on audit results, update the Agua Caliente All-Access reception event:

```sql
-- Step A: Find the event
SELECT id, name, product_key, contract_template_profile, google_template_doc_id
FROM events
WHERE name ILIKE '%Agua Caliente%' 
  OR (name ILIKE '%All%Access%' AND product_key = 'big_smoke')
ORDER BY year DESC;

-- Step B: Determine the correct template
-- Option 1: If Agua Caliente has its own template document
--   - Locate the Google Doc in Drive
--   - Copy the Doc ID from the URL: https://docs.google.com/document/d/DOC_ID_HERE/edit

-- Option 2: If it should use the Las Vegas template
--   - Use: 17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8

-- Step C: Update the event
UPDATE events
SET 
  google_template_doc_id = 'YOUR_TEMPLATE_DOC_ID',  -- from Step B
  contract_template_profile = 'big_smoke',
  product_key = 'big_smoke'
WHERE id = 'YOUR_EVENT_ID';  -- from Step A
```

#### 5. **Verify the Fix**
Generate a test contract for Agua Caliente:
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Create a new contract for Agua Caliente
3. Select the Agua Caliente/All-Access event
4. Generate the PDF
5. ✅ Verify it now uses the correct Big Smoke template (not WFNY)

---

### Proactive Actions (Prevent Future Issues)

#### 6. **Audit Other Big Smoke Events**
Check if there are other Big Smoke events that need templates configured:
```sql
SELECT 
  id,
  name,
  year,
  product_key,
  contract_template_profile,
  google_template_doc_id,
  is_active
FROM events
WHERE product_key = 'big_smoke'
ORDER BY year DESC, name;
```

For each event without `google_template_doc_id`:
- Locate or create the appropriate Google Doc template
- Update the event with the template Doc ID
- Run the audit script again to verify

#### 7. **Establish Event Setup Checklist**
When creating future Big Smoke events, ensure:
- [ ] `product_key = 'big_smoke'`
- [ ] `contract_template_profile = 'big_smoke'`
- [ ] `workflow_profile = 'events_managed'` (if events-managed)
- [ ] `google_template_doc_id = 'YOUR_TEMPLATE_DOC_ID'` ✨ **MUST SET!**
- [ ] Google Doc is shared with service account
- [ ] Test contract generation before going live

#### 8. **Monitor Template Resolution Logs**
After deployment, watch application logs for warnings:
```
[resolveContractTemplateDocId] Big Smoke event missing google_template_doc_id...
[resolveContractTemplateDocId] Event missing google_template_doc_id...
```

These indicate events that need template configuration.

#### 9. **Update Internal Documentation**
- Share `docs/TEMPLATE_CONFIGURATION.md` with the events team
- Add event setup checklist to internal wiki/runbook
- Train staff on running the audit script

#### 10. **Consider Future Enhancements**
Potential improvements (not urgent):
- Add database constraint or validation to require `google_template_doc_id` for Big Smoke events
- Create admin UI to show template configuration status
- Add automated alerts when new events are created without templates
- Enhance the audit script to check if Google Docs are accessible

---

## Quick Checklist Summary

### Must Do Now ⚡
- [ ] Merge PR #2
- [ ] Run audit script: `npx tsx scripts/audit-event-templates.mts`
- [ ] Fix Agua Caliente event with correct template Doc ID
- [ ] Test contract generation for Agua Caliente
- [ ] Fix any other misconfigured events found by audit

### Should Do Soon 📋
- [ ] Document event setup process using new checklist
- [ ] Share documentation with events team
- [ ] Set up log monitoring for template warnings
- [ ] Schedule quarterly template audits

### Nice to Have 💡
- [ ] Add UI indicators for template configuration status
- [ ] Automate template validation on event creation
- [ ] Create admin dashboard for template management

---

## Getting Help

- **Documentation**: See `docs/TEMPLATE_CONFIGURATION.md`
- **Step-by-Step Fix**: See `AGUA_CALIENTE_FIX.md`
- **Audit Tool**: Run `npx tsx scripts/audit-event-templates.mts`
- **Check Logs**: Look for `[resolveContractTemplateDocId]` warnings

## Files Changed in This Fix

1. `supabase/migrations/073_big_smoke_template_doc.sql` - Fixed to target Las Vegas only
2. `supabase/migrations/083_fix_big_smoke_template_specificity.sql` - New migration to clean up
3. `lib/contract-template.ts` - Added validation and warning logs
4. `scripts/audit-event-templates.mts` - New audit tool
5. `docs/TEMPLATE_CONFIGURATION.md` - New documentation
6. `AGUA_CALIENTE_FIX.md` - Specific fix instructions
7. This file - Issues fixed and next steps

---

**Status**: All code fixes are in PR #2 and ready for review/merge. Database fixes require manual SQL updates per event.
