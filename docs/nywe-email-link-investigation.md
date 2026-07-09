# NYWE Email Link Investigation

**Date:** July 8, 2026  
**Issue:** Some New York Wine Experience clients receiving WhiskyFest Advocate contract links in personal emails

## Problem Statement

When sending personal nudge emails to unsigned NYWE exhibitors, some clients were receiving links that pointed to the WhiskyFest Advocate portal (`wacontracts.whiskyadvocate.com`) instead of the correct Wine Spectator portal (`nywecontracts.winespectator.com`).

## System Architecture

The system supports two separate product lines:
- **WhiskyFest** (`product_key: 'whiskyfest'`) - Hosted at `wacontracts.whiskyadvocate.com`
- **Wine Spectator / NYWE** (`product_key: 'wine_spectator'`) - Hosted at `nywecontracts.winespectator.com`

Each contract is linked to an event, and each event has a `product_key` that determines which portal URLs should be used.

## Email Flow Analysis

When sending a personal nudge email:

1. **API Route** (`/api/contracts/[id]/send-personal-nudge`)
   - Fetches contract by ID
   - Fetches associated event by `contract.event_id`
   - Passes event to email function

2. **Email Function** (`sendPersonalContractNudgeEmail`)
   - Receives event with `product_key` field
   - Generates signing URL via `docuSignSigningRedirectUrl()`

3. **URL Generation** (`docuSignSigningRedirectUrl`)
   - Calls `productKeyFromEvent(event)` to get product key
   - Calls `appBaseUrlForProduct(productKey)` to get base URL
   - Returns: `{baseUrl}/api/contracts/{id}/docusign-sign?t={token}`

## Root Cause

The `productKeyFromEvent()` function silently defaults to `'whiskyfest'` in these scenarios:

```typescript
export function productKeyFromEvent(event: Pick<Event, 'product_key'> | null | undefined): ProductKey {
  return event?.product_key === PRODUCT_WINE_SPECTATOR ? PRODUCT_WINE_SPECTATOR : PRODUCT_WHISKYFEST;
}
```

This means:
- If `event` is `null` or `undefined` → defaults to `'whiskyfest'`
- If `event.product_key` is `null`, `undefined`, or anything other than `'wine_spectator'` → defaults to `'whiskyfest'`

## Possible Causes

Based on code analysis, the issue could occur if:

### 1. **Contracts Linked to Wrong Event**
NYWE contracts accidentally linked to WhiskyFest events (wrong `event_id` in database).

- How: Manual data entry error, migration issue, or bug in earlier code
- Impact: Contract fetches correct, but event has wrong `product_key`
- Solution: Use diagnostic script to find and fix mismatched contracts

### 2. **Missing Product Key**
Events with `NULL` or missing `product_key` field.

- How: Incomplete database migration or manual event creation
- Impact: Event loads but `product_key` is falsy
- Solution: Database migration 045 should have set default 'whiskyfest', but worth checking

### 3. **Event Not Found**
Contract references non-existent event ID.

- How: Deleted event, corrupted data
- Impact: Event query returns `null`, defaults to WhiskyFest
- Solution: Now throws clear error instead of silent failure

## Fix Implementation

### Code Changes

1. **Explicit Event Field Selection**
   ```typescript
   const { data: eventRow } = await supabase
     .from('events')
     .select('id, name, year, product_key')  // Explicit fields
     .eq('id', contract.event_id)
     .maybeSingle();
   ```

2. **Product Key Validation**
   ```typescript
   if (!event.product_key) {
     console.error('[send-personal-nudge] Event missing product_key', { ... });
     return NextResponse.json(
       { error: 'Event configuration error: missing product key. Please contact support.' },
       { status: 500 }
     );
   }
   ```

3. **Enhanced Logging**
   - Log event details when sending personal nudge
   - Log resolved product key and base URL
   - Log warnings in `productKeyFromEvent()` when data is missing

### Diagnostic Tools

Three new scripts help identify and fix issues:

1. **check-contract-event-product-keys.mts** - Quick overview
2. **diagnose-contract-event-mismatch.mts** - Detailed analysis
3. **fix-contract-event-mismatch.mts** - Automated fixes (with dry-run)

## How to Diagnose

If the issue occurs again:

```bash
# 1. Check application logs for errors
# Look for: [send-personal-nudge] or [docuSignSigningRedirectUrl] errors

# 2. Run diagnostic script
npx tsx scripts/diagnose-contract-event-mismatch.mts

# 3. If issues found, run fix script (dry-run first)
npx tsx scripts/fix-contract-event-mismatch.mts

# 4. Apply fixes if dry-run looks good
npx tsx scripts/fix-contract-event-mismatch.mts --apply
```

## Prevention

### Safeguards Now in Place

1. ✅ Explicit validation of event `product_key` before sending emails
2. ✅ Clear error messages instead of silent failures
3. ✅ Detailed logging for debugging
4. ✅ Diagnostic scripts for data quality checks

### Recommended Ongoing Practices

1. **Monitor Logs** - Watch for `[send-personal-nudge]` errors
2. **Periodic Audits** - Run diagnostic script monthly
3. **Event Creation** - Always set correct `product_key` when creating events
4. **Contract Creation** - Verify event selection in UI matches expected product line

## Database Schema Notes

From migration `045_nywe_multi_event.sql`:

```sql
alter table public.events
  add column if not exists product_key text not null default 'whiskyfest',
```

- `product_key` has `NOT NULL` constraint
- Default value is `'whiskyfest'`
- All events should have a product_key (never NULL)

If any event is missing `product_key`, it indicates a schema issue.

## Testing Recommendations

### Manual Testing

1. **NYWE Contract** with Wine Spectator event
   - Send personal nudge email
   - Verify link contains `nywecontracts.winespectator.com`

2. **WhiskyFest Contract** with WhiskyFest event
   - Send personal nudge email
   - Verify link contains `wacontracts.whiskyadvocate.com`

3. **Error Cases**
   - Try to send email for contract with missing event
   - Should receive clear error message

### Automated Testing

Consider adding integration tests:
- Test URL generation for both product types
- Test error handling when event is missing
- Test that diagnostic scripts can identify issues

## Additional Notes

### NYWE Contract Creation

NYWE contracts are created via:
1. **Exhibitor Roster Sync** - Automatic from Google Sheets
2. **Manual Creation** - Via `/wine-spectator/contracts/new`

Both paths explicitly filter events by `product_key = 'wine_spectator'`:

```typescript
// roster: getActiveWineSpectatorEvent()
// manual: scopeEventsByProduct(events, PRODUCT_WINE_SPECTATOR)
```

This makes it unlikely that NYWE contracts are created with wrong event_id through normal flows.

### Possible Edge Cases

1. **Manual Database Changes** - Someone updating event_id directly
2. **Event Deactivation** - Active NYWE event deactivated, contracts orphaned
3. **Multi-Year Events** - Multiple active NYWE events, wrong one selected
4. **Import Process** - Legacy imports might bypass validation

## Resolution Timeline

1. ✅ **Investigation** - Traced through email generation flow
2. ✅ **Fix Implementation** - Added validation and logging
3. ✅ **Diagnostic Tools** - Created scripts to identify issues
4. ✅ **PR Created** - #1 (draft)
5. ⏳ **Deploy to Production** - Pending review
6. ⏳ **Monitor Logs** - After deployment
7. ⏳ **Run Diagnostics** - If issues persist
8. ⏳ **Apply Fixes** - If mismatched contracts found

## Contact

For questions about this investigation or related issues:
- Review PR #1: https://github.com/mcapace/whiskyfest-contracts/pull/1
- Check logs in production for error patterns
- Run diagnostic scripts to identify specific contracts
