# Agua Caliente All-Access Reception - Template Fix

## The Problem You Encountered

When you tried to generate a contract for **Agua Caliente** for the **All-Access reception** using https://bigsmokecontracts.cigaraficionado.com/, it generated a **WFNY (WhiskyFest) contract** instead of the correct Big Smoke template.

## Why This Happened

The system's template resolution logic had a bug where:

1. **The Agua Caliente All-Access reception event** is missing its `google_template_doc_id` in the database
2. Without this field set, the system tried to use fallback logic
3. If the event's `contract_template_profile` wasn't set to `'big_smoke'`, it fell back to the WhiskyFest template

## What I Fixed

I've made the following changes (PR #2):

### 1. Fixed the Template Resolution Logic
- Updated the code to add warning logs when templates fall back to defaults
- Fixed a migration that was incorrectly applying Las Vegas template to all Big Smoke events
- Created a new migration to clear incorrect template assignments

### 2. Added Audit Tooling
- Created a script to identify misconfigured events: `scripts/audit-event-templates.mts`
- This will help prevent similar issues in the future

### 3. Added Documentation
- Comprehensive guide on how templates work: `docs/TEMPLATE_CONFIGURATION.md`

## What You Need to Do Next

### Step 1: Find the Agua Caliente Event

Run this query in your database (Supabase dashboard or SQL editor):

```sql
SELECT 
  id, 
  name, 
  product_key, 
  contract_template_profile, 
  google_template_doc_id
FROM events
WHERE name ILIKE '%Agua Caliente%' 
  OR name ILIKE '%All-Access%'
ORDER BY year DESC;
```

### Step 2: Get the Correct Google Doc Template ID

1. Go to Google Drive and locate the contract template for Agua Caliente All-Access reception
2. Open the document and copy the Doc ID from the URL:
   - URL format: `https://docs.google.com/document/d/DOC_ID_HERE/edit`
3. Or if you're using the same template as Las Vegas, use: `17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8`

### Step 3: Update the Event Configuration

Run this update query (replace `YOUR_EVENT_ID` and `YOUR_TEMPLATE_DOC_ID`):

```sql
UPDATE events
SET 
  google_template_doc_id = 'YOUR_TEMPLATE_DOC_ID',
  contract_template_profile = 'big_smoke',
  product_key = 'big_smoke'
WHERE id = 'YOUR_EVENT_ID';
```

### Step 4: Verify the Fix

After merging PR #2 and updating the database:

1. Run the audit script to check all events:
   ```bash
   npx tsx scripts/audit-event-templates.mts
   ```

2. Try generating a contract for Agua Caliente again
3. Verify it now uses the correct Big Smoke template

## Quick Reference: Event Fields

For any Big Smoke event, these fields should be set:

| Field | Value for Big Smoke | Example |
|-------|-------------------|---------|
| `product_key` | `'big_smoke'` | Required |
| `contract_template_profile` | `'big_smoke'` | Required |
| `google_template_doc_id` | Google Doc ID | **Set for each event!** |
| `workflow_profile` | `'events_managed'` | For events-managed workflow |

## Need Help?

- Check `docs/TEMPLATE_CONFIGURATION.md` for detailed documentation
- Run the audit script to find other misconfigured events
- The code now logs warnings when templates fall back to defaults

## Summary

The code fix is in PR #2. Once merged, you just need to:
1. Find the Agua Caliente event ID in your database
2. Update its `google_template_doc_id` with the correct template
3. Verify by generating a test contract

The bug that caused ALL Big Smoke events to use the Las Vegas template has been fixed!
