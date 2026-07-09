# Troubleshooting "Nowhere to Sign" Issues

**Issue:** Clients report receiving emails with signing links, but when they click the link, there's "nowhere for them to sign."

## Quick Diagnosis

After deploying the latest changes, check the application logs for these patterns:

### 1. Portal/Product Mismatch Warning

```
[docusign-sign] Portal/product mismatch detected
  contract_id: abc-123
  event_product_key: wine_spectator
  request_host: wacontracts.whiskyadvocate.com
  portal_kind: whiskyfest
  expected_portal: nywe
```

**This means:** A Wine Spectator (NYWE) contract is being accessed via the WhiskyFest portal URL. The personal nudge email sent the wrong domain.

**Root cause:** The contract's event has `product_key = 'wine_spectator'` but the email link used `wacontracts.whiskyadvocate.com` instead of `nywecontracts.winespectator.com`.

**Fix:** Run the diagnostic script to find mismatched contracts and fix the email generation logic.

### 2. Contract Not Found

```
[docusign-sign] Contract not found
  contract_id: abc-123
  url: https://wacontracts.whiskyadvocate.com/api/contracts/abc-123/docusign-sign?t=...
```

**This means:** The contract ID doesn't exist in the database (or the wrong database if portals are separate deployments).

**Root cause:** Either:
- Contract was deleted or never existed
- Wrong portal deployment (if NYWE and WhiskyFest use separate databases)
- Contract ID was corrupted in the email

**Fix:** Verify the contract exists and determine if portals share the same database.

### 3. Missing Envelope ID

```
[docusign-sign] Contract found
  contract_id: abc-123
  status: sent
  has_envelope: false
```

**This means:** The contract exists but doesn't have a `docusign_envelope_id`.

**Root cause:** The contract was marked as "sent" but the DocuSign envelope was never created or the ID wasn't saved.

**Fix:** Check the contract send process and ensure envelope IDs are being saved properly.

### 4. DocuSign API Error

```
[docusign-sign] Failed to create signing view
  contract_id: abc-123
  envelope_id: xyz-789
  error: ENVELOPE_DOES_NOT_EXIST
```

**This means:** DocuSign doesn't recognize the envelope ID.

**Root cause:** Either:
- Envelope was voided/deleted in DocuSign
- Wrong DocuSign account
- Envelope ID is corrupted

**Fix:** Check DocuSign console for the envelope, verify correct account is configured.

## Architecture Check

### Are the Portals Separate Deployments?

**Key Question:** Do `nywecontracts.winespectator.com` and `wacontracts.whiskyadvocate.com` point to:
- **Same deployment** (same app, same database, just different hostnames) ✅
- **Separate deployments** (different apps, different databases) ⚠️

If they're **separate deployments with separate databases**, then:
- NYWE contracts only exist in NYWE database
- WhiskyFest contracts only exist in WhiskyFest database
- **Wrong portal URL = contract not found**

To check:
```bash
# On NYWE portal server
echo $NEXT_PUBLIC_SUPABASE_URL

# On WhiskyFest portal server  
echo $NEXT_PUBLIC_SUPABASE_URL

# If these are different, portals have separate databases!
```

## Resolution Steps

### Step 1: Deploy Latest Changes

The PR includes logging that will help diagnose the exact issue.

### Step 2: Monitor Logs

When a client reports "nowhere to sign":
1. Get the contract ID from the URL they received
2. Search logs for `[docusign-sign]` with that contract ID
3. Look for the error patterns above

### Step 3: Check for Product Mismatch

```bash
# Run diagnostic script
npx tsx scripts/diagnose-contract-event-mismatch.mts
```

This will show:
- Contracts by product_key
- Contracts in "sent" status
- Any obvious mismatches

### Step 4: Fix Mismatched Contracts

If you find NYWE contracts with wrong event IDs:

```bash
# Dry run first
npx tsx scripts/fix-contract-event-mismatch.mts

# Apply fixes
npx tsx scripts/fix-contract-event-mismatch.mts --apply
```

### Step 5: Resend Corrected Links

After fixing contract event assignments:
1. Generate new personal nudge emails (they'll now use correct portal)
2. Clients receive new links with correct domain
3. Links should now work properly

## Email Link Structure

Personal nudge emails generate links like:

```
{base_url}/api/contracts/{contractId}/docusign-sign?t={token}
```

Where:
- `{base_url}` is determined by event's `product_key`:
  - `wine_spectator` → `https://nywecontracts.winespectator.com`
  - `whiskyfest` → `https://wacontracts.whiskyadvocate.com`
- `{contractId}` is the contract UUID
- `{token}` is HMAC security token (contractId + signerEmail)

### How the Link Works

1. **Client clicks link** → Goes to portal server
2. **Verify token** → Checks HMAC matches contract + email
3. **Look up contract** → Query database by contract ID
4. **Get envelope ID** → Extract `docusign_envelope_id` from contract
5. **Call DocuSign API** → Request signing view URL for that envelope
6. **Redirect to DocuSign** → Send client to actual signing page

If ANY step fails, client sees "nowhere to sign" error.

## Common Scenarios

### Scenario A: Wrong Portal Domain

**Symptom:** NYWE client gets `wacontracts.whiskyadvocate.com` link

**Logs show:**
```
[docusign-sign] Portal/product mismatch detected
  expected_portal: nywe
  portal_kind: whiskyfest
```

**Fix:**
1. Contract has wrong `event_id` (linked to WhiskyFest event)
2. Run fix script to reassign to Wine Spectator event
3. Resend personal nudge email (will generate correct URL)

### Scenario B: Envelope Not Created

**Symptom:** Client clicks link, sees error

**Logs show:**
```
[docusign-sign] Contract found
  has_envelope: false
```

**Fix:**
1. Contract send failed but status was updated to "sent"
2. Check contract send logs for original error
3. Re-send contract via DocuSign (creates new envelope)
4. Personal nudge email will now work

### Scenario C: Envelope Voided

**Symptom:** Client clicks link, sees DocuSign error

**Logs show:**
```
[docusign-sign] Failed to create signing view
  error: ENVELOPE_DOES_NOT_EXIST
```

**Fix:**
1. Envelope was voided or deleted in DocuSign
2. Check contract status in app (should show voided)
3. Create new contract or recall and resend

## Testing After Fix

To verify the fix is working:

### Test 1: NYWE Contract Link

1. Find an NYWE contract in "sent" status
2. Send personal nudge email
3. Check email received
4. Verify link contains `nywecontracts.winespectator.com`
5. Click link (should redirect to DocuSign)

### Test 2: WhiskyFest Contract Link

1. Find WhiskyFest contract in "sent" status
2. Send personal nudge email
3. Check email received
4. Verify link contains `wacontracts.whiskyadvocate.com`
5. Click link (should redirect to DocuSign)

### Test 3: Portal Mismatch Detection

1. Take an NYWE contract link
2. Manually change domain to WhiskyFest
3. Try to access link
4. Check logs for mismatch warning
5. Should see helpful error message

## Prevention

To prevent this issue going forward:

1. ✅ **Always validate event product_key** before sending emails
2. ✅ **Log all signing link generation** for audit trail
3. ✅ **Run monthly diagnostic** to catch mismatched contracts early
4. ✅ **Monitor logs** for portal mismatch warnings
5. ✅ **Test both portals** after any event-related changes

## Contact

If issues persist after following this guide:
1. Gather logs from affected contract IDs
2. Share diagnostic script output
3. Check if portals are separate deployments
4. Verify DocuSign account configuration
