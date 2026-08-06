# Contract Template Configuration

This document explains how contract templates are resolved and how to configure them correctly for different event types.

## Overview

When generating a contract PDF, the system needs to know which Google Doc template to use. The template is resolved by the `resolveContractTemplateDocId()` function in `lib/contract-template.ts`.

## Template Resolution Logic

The system follows this hierarchy (first match wins):

1. **Sponsorship-only contracts:**
   - Use `event.google_sponsorship_template_doc_id` if set
   - Fall back to `GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID` env var

2. **Event-specific template:**
   - Use `event.google_template_doc_id` if set ✅ **RECOMMENDED**

3. **Big Smoke fallback:**
   - If `event.contract_template_profile === 'big_smoke'`
   - Use `BIG_SMOKE_TEMPLATE_DOC_ID` env var or hardcoded Las Vegas template
   - ⚠️ **WARNING:** This may use the wrong template for non-Las Vegas Big Smoke events!

4. **WhiskyFest/NYWE fallback:**
   - Use `GOOGLE_TEMPLATE_DOC_ID` env var

## Common Issues

### Issue: Big Smoke contract generates WhiskyFest template

**Symptoms:**
- Creating a contract for a Big Smoke event
- Generated PDF uses WhiskyFest/WFNY template instead of Big Smoke template

**Root Cause:**
The event's `contract_template_profile` is not set to `'big_smoke'`, OR the event's `product_key` is incorrect.

**Solution:**
```sql
-- Check the event configuration
SELECT id, name, product_key, contract_template_profile, google_template_doc_id
FROM events
WHERE name ILIKE '%your event name%';

-- Fix: Set the correct profile
UPDATE events
SET contract_template_profile = 'big_smoke'
WHERE id = 'your-event-id';

-- Best practice: Set event-specific template
UPDATE events
SET google_template_doc_id = 'your-google-doc-id-here'
WHERE id = 'your-event-id';
```

### Issue: Big Smoke event uses Las Vegas template for different event

**Symptoms:**
- Creating a contract for Agua Caliente or other Big Smoke event
- Generated PDF uses Las Vegas Big Smoke template

**Root Cause:**
Migration `073_big_smoke_template_doc.sql` previously set the Las Vegas template for ALL Big Smoke events with missing templates. Each event should have its own template.

**Solution:**
```sql
-- Set the correct template for your specific event
UPDATE events
SET google_template_doc_id = 'your-event-specific-template-doc-id'
WHERE id = 'your-event-id';
```

## Configuration Fields

### `events.product_key`
Determines which portal the event belongs to:
- `'whiskyfest'` - WhiskyFest portal
- `'wine_spectator'` - Wine Spectator/NYWE portal
- `'big_smoke'` - Big Smoke/Cigar Aficionado portal

### `events.contract_template_profile`
Determines template resolution logic:
- `'whiskyfest'` - WhiskyFest booth contracts
- `'nywe_vendor'` - NYWE vendor licenses
- `'big_smoke'` - Big Smoke exhibitor contracts

**Important:** This should generally match the `product_key`!

### `events.google_template_doc_id`
The Google Doc ID for this specific event's contract template.

**Best Practice:** ALWAYS set this for production events to avoid fallback logic.

### `events.google_sponsorship_template_doc_id`
Optional: Separate template for sponsorship-only contracts (no booth).

## Auditing Template Configuration

Run the audit script to check for misconfigured events:

```bash
npx tsx scripts/audit-event-templates.mts
```

This will identify:
- Big Smoke events missing templates
- Events with mismatched product_key and template_profile
- Events relying on fallback templates

## Adding a New Event

When creating a new event, ALWAYS set these fields:

```sql
INSERT INTO events (
  name,
  product_key,
  contract_template_profile,
  google_template_doc_id,
  -- ... other fields
) VALUES (
  'Big Smoke Agua Caliente All-Access Reception 2026',
  'big_smoke',
  'big_smoke',
  'YOUR-GOOGLE-DOC-ID-HERE',  -- ← REQUIRED!
  -- ... other values
);
```

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `GOOGLE_TEMPLATE_DOC_ID` | WhiskyFest default template | `1W5wJv...` |
| `BIG_SMOKE_TEMPLATE_DOC_ID` | Big Smoke Las Vegas fallback | `17-kWF...` |
| `GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID` | Sponsorship-only fallback | `1rL_IZ...` |

## Related Files

- `lib/contract-template.ts` - Template resolution logic
- `lib/contract-template-profile.ts` - Profile determination
- `supabase/migrations/073_big_smoke_template_doc.sql` - Big Smoke template setup
- `supabase/migrations/083_fix_big_smoke_template_specificity.sql` - Template fix
- `scripts/audit-event-templates.mts` - Configuration audit tool
