# Contract Template Resolution Flow

This document shows how the system resolves which Google Doc template to use when generating contracts.

## ✅ AFTER FIX (Current Behavior)

```
┌─────────────────────────────────────────────────────────────┐
│ User Generates Contract                                      │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Is it a sponsorship-only contract?                           │
└─────┬─────────────────────────────────────────────┬─────────┘
      ↓ YES                                          ↓ NO
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│ Check event.google_              │    │ Check event.google_              │
│ sponsorship_template_doc_id      │    │ template_doc_id                  │
└─────┬───────────────────────────┘    └─────┬───────────────────────────┘
      ↓ If set → Use it ✅                    ↓ If set → Use it ✅
      ↓ If not set                             ↓ If not set
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│ Use GOOGLE_SPONSORSHIP_          │    │ Check contract_template_profile  │
│ TEMPLATE_DOC_ID env var          │    └─────┬───────────────────────────┘
└──────────────────────────────────┘          ↓
                                    ┌─────────┴─────────┬─────────────────┐
                                    ↓ big_smoke         ↓ whiskyfest/nywe  ↓
                          ┌─────────────────────┐  ┌────────────────────┐
                          │ ⚠️ WARNING LOGGED:   │  │ ℹ️ INFO LOGGED:     │
                          │ "Big Smoke event    │  │ "Event missing     │
                          │ missing template"   │  │ template, using    │
                          │                     │  │ fallback"          │
                          └─────────┬───────────┘  └─────────┬──────────┘
                                    ↓                         ↓
                          ┌─────────────────────┐  ┌────────────────────┐
                          │ Use BIG_SMOKE_       │  │ Use GOOGLE_        │
                          │ TEMPLATE_DOC_ID      │  │ TEMPLATE_DOC_ID    │
                          │ (Las Vegas fallback) │  │ (WhiskyFest)       │
                          └──────────────────────┘  └────────────────────┘
```

---

## ❌ BEFORE FIX (Old Broken Behavior)

```
┌─────────────────────────────────────────────────────────────┐
│ User Generates Contract for Agua Caliente All-Access        │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Event: Agua Caliente All-Access                              │
│ - google_template_doc_id: NULL (not set!)                    │
│ - contract_template_profile: NULL or wrong                   │
│ - product_key: "big_smoke"                                   │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Check event.google_template_doc_id                           │
└─────┬───────────────────────────────────────────────────────┘
      ↓ Not set, check profile...
┌─────────────────────────────────────────────────────────────┐
│ contract_template_profile != 'big_smoke'                     │
│ (Either NULL or misconfigured)                               │
└─────┬───────────────────────────────────────────────────────┘
      ↓ Falls through to default...
┌─────────────────────────────────────────────────────────────┐
│ ❌ Use GOOGLE_TEMPLATE_DOC_ID (WhiskyFest template!)         │
│ ❌ NO WARNING - SILENT FAILURE!                              │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Result: Agua Caliente gets WFNY template with wrong:        │
│ - Branding (WhiskyFest logo instead of Big Smoke)           │
│ - Terms and conditions                                       │
│ - Pricing structure                                          │
│ - Event details                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 What Changed

### 1. Migration 073 Fix
**Before:**
```sql
-- Applied Las Vegas template to ALL Big Smoke events with null template
UPDATE events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND (google_template_doc_id IS NULL OR trim(google_template_doc_id) = '');
  -- ❌ This affected Agua Caliente too!
```

**After:**
```sql
-- Only applies Las Vegas template to Las Vegas event specifically
UPDATE events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND year = 2026
  AND name ILIKE '%Las Vegas%'
  AND (google_template_doc_id IS NULL OR trim(google_template_doc_id) = '');
  -- ✅ Only Las Vegas gets this template!
```

### 2. Migration 083 Cleanup
```sql
-- Clear incorrect template assignments from non-Las Vegas Big Smoke events
UPDATE events
SET google_template_doc_id = NULL
WHERE product_key = 'big_smoke'
  AND google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  AND NOT (year = 2026 AND name ILIKE '%Las Vegas%');
  -- ✅ Agua Caliente's wrong template is cleared!
```

### 3. Added Warning Logs
```typescript
// Now logs a warning when falling back to default templates
if (templateProfile === 'big_smoke') {
  console.warn(
    `[resolveContractTemplateDocId] Big Smoke event missing google_template_doc_id, ` +
    `falling back to ${fallbackId}. This may use the wrong template.`
  );
  return fallbackId;
}
// ✅ Admins will see warnings in logs!
```

---

## 🎯 Best Practice: Event Setup

For each new Big Smoke event, ALWAYS:

```sql
INSERT INTO events (
  name,
  product_key,                    -- Set to 'big_smoke'
  contract_template_profile,      -- Set to 'big_smoke'
  google_template_doc_id,         -- ✨ MUST SET THIS! ✨
  workflow_profile,
  -- ... other fields
) VALUES (
  'Big Smoke Agua Caliente All-Access Reception 2026',
  'big_smoke',
  'big_smoke',
  'YOUR-SPECIFIC-GOOGLE-DOC-ID',  -- ← Get from Google Drive!
  'events_managed',
  -- ... other values
);
```

**Never leave `google_template_doc_id` NULL for production events!**

---

## 🔍 How to Check Your Events

Run the audit script:
```bash
npx tsx scripts/audit-event-templates.mts
```

Output example:
```
=== Event Template Configuration Audit ===

📋 Big Smoke Agua Caliente All-Access 2026
   Product: big_smoke
   Profile: big_smoke
   Template Doc ID: (not set)
   ❌ Big Smoke event missing google_template_doc_id - will use Las Vegas fallback template

📋 Big Smoke Las Vegas 2026
   Product: big_smoke
   Profile: big_smoke
   Template Doc ID: 17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8
   ✅ No issues!
```

---

## 📚 Related Documentation

- `SUMMARY.md` - Executive summary
- `AGUA_CALIENTE_FIX.md` - Step-by-step fix instructions
- `ISSUES_FIXED_AND_NEXT_STEPS.md` - Complete issues list and action plan
- `docs/TEMPLATE_CONFIGURATION.md` - Detailed configuration guide
- `lib/contract-template.ts` - Source code with inline comments

---

## 🆘 Quick Fix Commands

```sql
-- 1. Find your event
SELECT id, name, google_template_doc_id, contract_template_profile
FROM events
WHERE name ILIKE '%your event name%';

-- 2. Set the correct template
UPDATE events
SET 
  google_template_doc_id = 'YOUR_GOOGLE_DOC_ID',
  contract_template_profile = 'big_smoke',
  product_key = 'big_smoke'
WHERE id = 'your-event-id';

-- 3. Verify
SELECT name, google_template_doc_id FROM events WHERE id = 'your-event-id';
```

Then test by generating a contract! ✅
