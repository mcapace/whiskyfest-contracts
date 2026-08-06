# What Actually Happened & The Real Fix

## Your Situation (Clarified)

You have **3 separate portals**:
1. **WhiskyFest** - wacontracts.whiskyadvocate.com
2. **Wine Spectator (NYWE)** - nywecontracts.winespectator.com  
3. **Big Smoke** - bigsmokecontracts.cigaraficionado.com

You were on `bigsmokecontracts.cigaraficionado.com` trying to create a contract for **Agua Caliente (a client)** for the **Big Smoke Las Vegas** event, and it generated a **WhiskyFest (WFNY) contract template** instead of the **Big Smoke template**.

---

## What I Fixed

The code had a bug where:
- If the Big Smoke Las Vegas event was missing its `google_template_doc_id`
- OR if it had the wrong `contract_template_profile`
- It would fall back to the WhiskyFest template

**The fix ensures**:
1. ✅ Big Smoke events use Big Smoke templates (not WhiskyFest)
2. ✅ WhiskyFest events use WhiskyFest templates
3. ✅ Wine Spectator events use Wine Spectator templates
4. ✅ Warning logs alert you if configurations are wrong

---

## Do You Need to Redo the Contract?

**YES** - If you already sent the contract to Agua Caliente with the wrong (WhiskyFest) template, you should:

1. **After merging this PR**, regenerate the contract
2. It will now use the correct Big Smoke template
3. Send the new contract to replace the wrong one

---

## What To Do Next (SIMPLE VERSION)

### Step 1: Merge the PR ✅
https://github.com/mcapace/whiskyfest-contracts/pull/2

This fixes the code so templates route correctly.

### Step 2: Check Your Big Smoke Event Configuration
Run this SQL query to see if your Big Smoke Las Vegas event is configured correctly:

```sql
SELECT 
  id,
  name,
  year,
  product_key,
  contract_template_profile,
  google_template_doc_id
FROM events
WHERE product_key = 'big_smoke' 
  OR name ILIKE '%Big Smoke%'
  OR name ILIKE '%Las Vegas%';
```

**What you should see**:
- `product_key`: `'big_smoke'`
- `contract_template_profile`: `'big_smoke'`
- `google_template_doc_id`: Should have a Google Doc ID (like `'17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'`)

**If `google_template_doc_id` is empty or missing**:
```sql
UPDATE events
SET 
  google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8',
  contract_template_profile = 'big_smoke',
  product_key = 'big_smoke'
WHERE name ILIKE '%Big Smoke%Las Vegas%' AND year = 2026;
```

### Step 3: Test It
1. Go to https://bigsmokecontracts.cigaraficionado.com/
2. Create a NEW test contract for any client (or regenerate Agua Caliente's contract)
3. Generate the PDF
4. ✅ **Verify it now shows Big Smoke branding** (not WhiskyFest/WFNY)

### Step 4: Resend to Agua Caliente (if needed)
If you already sent the wrong contract, regenerate and resend the correct one.

---

## Will This Affect WhiskyFest or Wine Spectator?

**NO** - This fix only affects Big Smoke. Here's how each portal works:

| Portal | Host | Event Selection | Template Used |
|--------|------|-----------------|---------------|
| **WhiskyFest** | wacontracts.whiskyadvocate.com | WhiskyFest events | WhiskyFest template ✅ |
| **Wine Spectator** | nywecontracts.winespectator.com | NYWE events | Wine Spectator template ✅ |
| **Big Smoke** | bigsmokecontracts.cigaraficionado.com | Big Smoke Las Vegas | Big Smoke template ✅ (after fix) |

Each portal is completely separate and only shows its own events.

---

## Technical Summary

**Before the fix**:
```
bigsmokecontracts.cigaraficionado.com
  → Select "Big Smoke Las Vegas" event
  → Create contract for "Agua Caliente"  
  → Event missing google_template_doc_id OR wrong profile
  → Falls back to WhiskyFest template
  → ❌ Generated WFNY contract
```

**After the fix**:
```
bigsmokecontracts.cigaraficionado.com
  → Select "Big Smoke Las Vegas" event
  → Create contract for "Agua Caliente"
  → Event has google_template_doc_id = Big Smoke template
  → ✅ Generated Big Smoke contract
```

---

## Quick Answer to Your Questions

**Q: Is the contract fixed?**  
A: Once you merge the PR and verify the event configuration, **YES**, new contracts will use the correct template.

**Q: Do I need to redo it?**  
A: **YES**, if you already sent Agua Caliente the wrong (WhiskyFest) contract, regenerate and resend after the fix.

**Q: Will this affect WhiskyFest?**  
A: **NO**, WhiskyFest contracts will continue to use WhiskyFest templates. Each portal is separate.

**Q: Will this affect Wine Spectator?**  
A: **NO**, Wine Spectator/NYWE contracts will continue to use Wine Spectator templates.

---

## Files Changed (Technical)

- `supabase/migrations/073_big_smoke_template_doc.sql` - Fixed to only apply template to Las Vegas
- `supabase/migrations/083_fix_big_smoke_template_specificity.sql` - Cleanup migration
- `lib/contract-template.ts` - Added warnings when wrong templates are used

---

## Bottom Line

1. ✅ **Merge the PR**
2. ✅ **Check Big Smoke event has `google_template_doc_id` set** (fix if needed)
3. ✅ **Regenerate Agua Caliente contract** → should now be Big Smoke template
4. ✅ **All future Big Smoke contracts will use Big Smoke template**
5. ✅ **WhiskyFest and Wine Spectator are unchanged and working correctly**

**Time: 5-10 minutes total**
