# Cross-Portal Email Link Functionality

## Overview

The personal nudge email system **automatically generates the correct portal URL** based on the contract's event, regardless of which portal the staff member is using to send the email.

## How It Works

### Email Link Generation

When a staff member sends a personal nudge email:

1. **System looks up the contract** → Gets the contract details
2. **System looks up the event** → Gets the event's `product_key`
3. **System determines the correct portal** based on `product_key`:
   - `product_key = 'wine_spectator'` → Wine Spectator portal URL
   - `product_key = 'whiskyfest'` → WhiskyFest portal URL
4. **System generates the signing URL** with the correct portal domain
5. **System sends the email** with the correct link

**The portal domain in the email is determined by the CONTRACT, not by where the staff member is sending from.**

### Supported Scenarios

All of these scenarios work correctly:

| Staff Portal | Contract Type | Generated URL | Result |
|--------------|---------------|---------------|---------|
| Wine Spectator | Wine contract | `nywecontracts.winespectator.com` | ✅ Correct |
| Wine Spectator | Whisky contract | `wacontracts.whiskyadvocate.com` | ✅ Correct |
| WhiskyFest | Whisky contract | `wacontracts.whiskyadvocate.com` | ✅ Correct |
| WhiskyFest | Wine contract | `nywecontracts.winespectator.com` | ✅ Correct |

### Signing Link Access

When a client clicks the signing link:

1. **Link contains the contract ID** and security token
2. **Browser goes to the portal domain** specified in the URL
3. **Portal looks up the contract** from the shared database
4. **Portal verifies the token** (contract ID + signer email)
5. **Portal gets the DocuSign envelope ID** from the contract
6. **Portal redirects to DocuSign** for signing

**Both portals can access any contract** because they share the same database and DocuSign account.

## Why Cross-Portal Access is Supported

### Use Case 1: Staff with Access to Both Portals

Some staff members have access to both Wine Spectator and WhiskyFest portals. They should be able to send personal nudge emails for any contract from either portal, and the system will automatically generate the correct URL.

**Example:**
- Admin user logs into WhiskyFest portal
- Sees a Wine Spectator contract that needs a nudge
- Sends personal email from WhiskyFest portal
- System generates Wine Spectator URL (correct!)
- Client receives link to Wine Spectator portal

### Use Case 2: Shared Database Architecture

If both portals are the same application (just different hostnames), then:
- Both portals access the same Supabase database
- Both portals use the same DocuSign account
- A Wine contract can be accessed via either portal URL
- The signing process works regardless of which domain is used

**However:** The email should still generate the correct "branded" URL to avoid confusion.

## Implementation Details

### Code Path: Send Personal Nudge Email

```typescript
// API: /api/contracts/[id]/send-personal-nudge
// Shared endpoint accessible from both portals

1. Fetch contract by ID
2. Fetch event by contract.event_id
3. Get event.product_key
4. Call sendPersonalContractNudgeEmail({
     event, // Contains product_key
     ...
   })
5. Inside email function:
   - docuSignSigningRedirectUrl(contractId, event, signerEmail)
   - appBaseUrlForProduct(productKeyFromEvent(event))
   - Returns: {correct_portal_url}/api/contracts/{id}/docusign-sign?t={token}
```

### Code Path: Client Clicks Signing Link

```typescript
// API: /api/contracts/[id]/docusign-sign
// Shared endpoint accessible from both portals

1. Verify token (HMAC of contractId + signerEmail)
2. Look up contract in database
3. Check contract.status (must be 'sent' or 'partially_signed')
4. Get contract.docusign_envelope_id
5. Call DocuSign API to create signing view URL
6. Redirect to DocuSign
```

## Portal Mismatch Detection

The system logs a **warning** (not an error) when it detects cross-portal access:

```
[docusign-sign] Portal/product mismatch detected (signing will still proceed)
  contract_id: abc-123
  event_product_key: wine_spectator
  request_host: wacontracts.whiskyadvocate.com
  portal_kind: whiskyfest
  expected_portal: nywe
```

**What this means:**
- A Wine Spectator contract is being accessed via the WhiskyFest portal URL
- The signing process will still work
- This warning helps diagnose if URLs are being **systematically generated incorrectly**

**This is NOT an error** - it's informational for debugging.

### When to Investigate

⚠️ **Investigate if you see many mismatches** - This could indicate:
- Email generation is using wrong product_key
- Contracts are linked to wrong events
- URL generation logic has a bug

✅ **Occasional mismatches are expected** - Staff members with access to both portals may legitimately access contracts cross-portal.

## Testing Cross-Portal Functionality

### Test 1: Wine Portal → Whisky Contract Email

1. Log into Wine Spectator portal as admin
2. Find a WhiskyFest contract in "sent" status
3. Send personal nudge email
4. Check the email received
5. ✅ URL should be `wacontracts.whiskyadvocate.com` (Whisky portal)
6. Click the link
7. ✅ Should redirect to DocuSign successfully

### Test 2: Whisky Portal → Wine Contract Email

1. Log into WhiskyFest portal as admin
2. Find a Wine Spectator contract in "sent" status
3. Send personal nudge email
4. Check the email received
5. ✅ URL should be `nywecontracts.winespectator.com` (Wine portal)
6. Click the link
7. ✅ Should redirect to DocuSign successfully

### Test 3: Direct Cross-Portal Access

1. Get a Wine Spectator contract signing URL
2. Manually change the domain to WhiskyFest
3. Try to access the modified URL
4. ✅ Should still work (if portals share database)
5. Check logs for mismatch warning (informational only)

## Configuration

### Correct Configuration (Current)

```typescript
// lib/product-email.ts
export function appBaseUrlForProduct(productKey: ProductKey | null | undefined): string {
  if (productKey === PRODUCT_WINE_SPECTATOR) return nywePortalOrigin();
  return whiskyfestPortalOrigin();
}

// lib/product-portal.ts
export function productKeyFromEvent(event: Pick<Event, 'product_key'> | null | undefined): ProductKey {
  if (!event) {
    console.warn('[productKeyFromEvent] Event is null/undefined, defaulting to whiskyfest');
    return PRODUCT_WHISKYFEST;
  }
  if (!event.product_key) {
    console.error('[productKeyFromEvent] Event missing product_key field', { event });
    return PRODUCT_WHISKYFEST;
  }
  return event.product_key === PRODUCT_WINE_SPECTATOR ? PRODUCT_WINE_SPECTATOR : PRODUCT_WHISKYFEST;
}
```

**Key points:**
- URL is determined by event's `product_key`, not request origin
- Wine Spectator contracts always get Wine Spectator URLs
- WhiskyFest contracts always get WhiskyFest URLs
- Works correctly regardless of which portal sends the email

### What Would Be Wrong ❌

```typescript
// WRONG: Using request host to determine URL
export function appBaseUrlForProduct(req: Request, productKey: ProductKey): string {
  const host = req.headers.get('host');
  if (host.includes('nywecontracts')) return nywePortalOrigin();
  return whiskyfestPortalOrigin();
}
```

This would generate wrong URLs when sending cross-portal emails!

## Summary

✅ **Email URL generation is contract-based** - Correct portal URL is automatically determined by the contract's event `product_key`

✅ **Cross-portal sending works** - Staff can send emails from either portal for any contract type

✅ **Cross-portal access works** - Signing links work even if accessed via "wrong" portal (if portals share database)

✅ **Mismatch detection is informational** - Warnings help diagnose systematic issues but don't block functionality

✅ **Current implementation is correct** - No changes needed for cross-portal functionality

The system is designed to "just work" regardless of which portal staff members use. The correct URLs are generated automatically based on the contract's event type.
