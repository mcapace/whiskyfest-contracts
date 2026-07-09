# Personal Nudge Email Complete Flow

## Yes! The Complete Flow Works End-to-End ✅

When you send a personal nudge email, the link allows the client to sign the contract **and the system automatically updates** when they sign.

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Staff Sends Personal Nudge Email                           │
│                                                                      │
│ Wine or Whisky Portal → Send Personal Note                         │
│                          ↓                                           │
│ API: /api/contracts/{id}/send-personal-nudge                       │
│  • Fetch contract by ID                                             │
│  • Fetch event (get product_key)                                   │
│  • Generate correct portal URL based on event.product_key          │
│  • Create security token (HMAC of contractId + signerEmail)        │
│  • Send email with signing link                                     │
└─────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Client Receives Email                                       │
│                                                                      │
│ Email contains:                                                      │
│  • Personal message from staff                                      │
│  • "Review and sign agreement" button                               │
│  • Link: {portal_url}/api/contracts/{id}/docusign-sign?t={token}  │
│                                                                      │
│ Portal URL is automatically correct:                                │
│  • Wine contracts → nywecontracts.winespectator.com                │
│  • Whisky contracts → wacontracts.whiskyadvocate.com               │
└─────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Client Clicks Link                                          │
│                                                                      │
│ Browser → Portal Server                                             │
│ API: /api/contracts/{id}/docusign-sign?t={token}                   │
│  • Verify security token                                            │
│  • Look up contract in database                                     │
│  • Check contract status (must be 'sent')                           │
│  • Get DocuSign envelope ID                                         │
│  • Call DocuSign API to create signing view URL                     │
│  • Redirect client to DocuSign                                      │
└─────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Client Signs in DocuSign                                    │
│                                                                      │
│ DocuSign Portal                                                      │
│  • Client reviews the contract PDF                                  │
│  • Client adds their signature                                      │
│  • Client clicks "Finish"                                           │
│  • DocuSign sends webhook to your system                            │
└─────────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: System Automatically Updates ✅                            │
│                                                                      │
│ DocuSign Webhook → Your Server                                      │
│ API: /api/webhooks/docusign                                         │
│                                                                      │
│ When exhibitor signs (first signature):                             │
│  • Update contract status: 'sent' → 'partially_signed'             │
│  • Update contract.signed_at timestamp                              │
│  • Send notifications to staff                                      │
│  • Trigger countersignature process                                 │
│                                                                      │
│ When countersigner signs (fully signed):                            │
│  • Update contract status: 'partially_signed' → 'signed'           │
│  • Update contract.executed_at timestamp                            │
│  • Download signed PDF                                              │
│  • Save signed PDF to storage                                       │
│  • Auto-release to accounting (if configured)                       │
│  • Send completion notifications                                    │
│  • Update Google Sheets tracker                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Email Link Generation
**File:** `lib/contract-personal-nudge-email.ts`

```typescript
const signingUrl = docuSignSigningRedirectUrl(p.contractId, p.event, p.signerEmail);
// Example result:
// https://nywecontracts.winespectator.com/api/contracts/abc-123/docusign-sign?t=xyz789
```

**URL Components:**
- `{portal_url}` - Correct portal based on event.product_key
- `{contractId}` - UUID of the contract
- `{token}` - HMAC security token (prevents unauthorized access)

### 2. Signing Link Handler
**File:** `app/api/contracts/[id]/docusign-sign/route.ts`

**Security:**
- Verifies HMAC token matches contract + signer email
- Only works for contracts in 'sent' or 'partially_signed' status
- Token is specific to the signer (can't be used by someone else)

**Process:**
1. Validate token
2. Fetch contract and envelope ID
3. Call DocuSign API: `createExhibitorSigningViewUrl()`
4. Redirect to DocuSign signing session

### 3. DocuSign Webhook Handler
**File:** `app/api/webhooks/docusign/route.ts`

**Handles These Events:**
- `recipient-completed` - Exhibitor signed
- `envelope-completed` - All parties signed
- `envelope-voided` - Contract was cancelled
- `envelope-declined` - Signer declined

**Updates Performed:**
```typescript
// Exhibitor signs (partial signature)
await applyExhibitorPartialSignature(supabase, contract, event, envelopeId);
// → Status: 'sent' → 'partially_signed'
// → Notifications sent to staff
// → Countersigner receives DocuSign email

// Both parties signed (fully signed)
await applyEnvelopeFullySigned(supabase, contract, event, envelopeId);
// → Status: 'partially_signed' → 'signed'
// → Signed PDF downloaded and stored
// → Auto-release to accounting (if configured)
// → Notifications sent
// → Google Sheets updated
```

## Security Features

### HMAC Token
- Generated using contract ID + signer email + secret key
- Prevents tampering with URLs
- Can't be used by different email address
- One-time use per signing session

### Status Validation
- Only works for contracts in correct status
- Already signed contracts show friendly message
- Voided contracts are rejected

### Cross-Portal Support
- Links work even if accessed via "wrong" portal
- Both portals share same database and DocuSign account
- Signing succeeds regardless of which portal URL is used

## Notifications Sent

### When Exhibitor Signs (Partial)
**Recipients:** Events team, sales rep, rep assistants

**Content:**
- "{Company} signed — countersign in DocuSign" (NYWE)
- "{Person} from {Company} signed — awaiting countersignature" (WhiskyFest)
- Contract pricing details
- Link to contract in portal

### When Fully Signed
**Recipients:** Events team, sales rep, rep assistants, accounting

**Content:**
- "{Company} — fully signed and ready for release"
- Exhibitor and countersigner names
- Contract pricing
- Note that it's ready for accounting

## Auto-Release to Accounting

For NYWE contracts (and optionally WhiskyFest):
- Automatically releases to accounting after full signature
- Sends notifications to accounting team
- Updates contract status to 'executed'
- No manual release button needed

## Data Updates

### Contract Record Updates
```sql
-- After exhibitor signs
UPDATE contracts SET
  status = 'partially_signed',
  signed_at = NOW(),
  updated_at = NOW()
WHERE id = {contractId};

-- After fully signed
UPDATE contracts SET
  status = 'signed',
  executed_at = NOW(),
  signed_pdf_url = {url},
  signed_pdf_drive_id = {id},
  updated_at = NOW()
WHERE id = {contractId};

-- After auto-release
UPDATE contracts SET
  status = 'executed',
  released_at = NOW(),
  released_by = 'system',
  updated_at = NOW()
WHERE id = {contractId};
```

### Google Sheets Updates
If contract is tracked in Google Sheets:
- Status column updated to 'signed' or 'executed'
- Tracking maintains sync between app and spreadsheet

## Testing the Complete Flow

### Manual Test
1. **Send personal nudge email** from either portal
2. **Check client inbox** - Verify correct portal URL in link
3. **Click the link** - Should redirect to DocuSign
4. **Sign the document** in DocuSign
5. **Wait ~30 seconds** for webhook
6. **Refresh contract page** - Status should be 'partially_signed'
7. **Countersigner signs** in DocuSign
8. **Wait ~30 seconds** for webhook
9. **Refresh contract page** - Status should be 'signed' or 'executed'
10. **Check notifications** - Staff should receive emails
11. **Check accounting** - Should show in accounting if auto-released

### Webhook Testing
```bash
# Check webhook logs
grep "docusign-webhook" /var/log/app.log

# Should see:
[docusign-webhook] recipient-completed received for {envelopeId}
[docusign-webhook] Applying exhibitor partial signature
[docusign-webhook] envelope-completed received for {envelopeId}
[docusign-webhook] Applying fully signed status
```

## Troubleshooting

### Client Reports "Nothing to Sign"
**Check logs for:**
```
[docusign-sign] Contract not found
→ Wrong portal or contract doesn't exist

[docusign-sign] Contract found, has_envelope: false
→ Envelope was never created

[docusign-sign] Failed to create signing view
→ DocuSign API error
```

**Solutions:**
1. Verify contract exists and has envelope ID
2. Check DocuSign console for envelope status
3. Resend contract via DocuSign if needed

### Status Not Updating After Signing
**Check:**
1. **Webhook is configured** in DocuSign Connect
2. **Webhook logs** show events received
3. **Contract has correct envelope ID**
4. **Database updates** aren't being blocked

**DocuSign Connect Settings:**
- URL: `https://{your-domain}/api/webhooks/docusign`
- Events: All envelope and recipient events
- HMAC secret: Set in `DOCUSIGN_CONNECT_HMAC_SECRET`

## Summary

✅ **Yes, the complete flow works:**

1. Staff sends email → Client receives correct portal link
2. Client clicks link → Redirected to DocuSign
3. Client signs → DocuSign sends webhook
4. System receives webhook → Updates database
5. Status changes → Notifications sent
6. Signed PDF stored → Auto-released to accounting
7. All stakeholders notified → Process complete

**The system is fully automated** - no manual status updates needed after the client signs!
