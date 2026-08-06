# How to Void the Old Agua Caliente Contract

## Quick Instructions

The system has a built-in "Void" function that will mark the contract as voided and void it in DocuSign (if it was sent).

### Steps:

1. **Log into the Big Smoke portal**  
   Go to: https://bigsmokecontracts.cigaraficionado.com/

2. **Find the Agua Caliente contract**  
   - Go to Contracts list
   - Search for "Agua Caliente"
   - Click on the contract to open it

3. **Void the contract**  
   - Look for the "Void" button (usually in the contract actions)
   - Click "Void"
   - Enter a reason: `"Wrong template used - regenerating with correct Big Smoke template"`
   - Confirm

4. **What happens when you void:**
   - ✅ Contract status changes to "voided"
   - ✅ DocuSign envelope is voided (if it was sent)
   - ✅ Sales rep is notified
   - ✅ Accounting records are updated
   - ✅ Contract is marked in tracking sheets

5. **Have Jake regenerate the contract**  
   After this PR is merged:
   - Jake creates a NEW contract for Agua Caliente
   - The new one will use the correct Big Smoke template
   - Send the new correct contract to the client

---

## Alternative: If You Can't Access the Portal

If you need to void it via SQL:

```sql
-- 1. Find the contract ID
SELECT id, exhibitor_company_name, status, docusign_envelope_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%Agua Caliente%'
  AND status != 'voided'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Void it (replace YOUR_CONTRACT_ID)
UPDATE contracts
SET 
  status = 'voided',
  voided_at = NOW(),
  voided_by = 'your-email@mshanken.com',
  voided_reason = 'Wrong template used - regenerating with correct Big Smoke template'
WHERE id = 'YOUR_CONTRACT_ID';

-- 3. Add audit log entry
INSERT INTO audit_log (
  contract_id,
  actor_email,
  action,
  from_status,
  to_status,
  metadata
) VALUES (
  'YOUR_CONTRACT_ID',
  'your-email@mshanken.com',
  'contract_voided',
  'sent',  -- or whatever the old status was
  'voided',
  '{"reason": "Wrong template used - regenerating with correct Big Smoke template"}'::jsonb
);
```

**Note**: The SQL approach won't void the DocuSign envelope - use the portal "Void" button if the contract was sent to DocuSign.

---

## Summary

**Best approach**: Use the portal's "Void" button → Let Jake regenerate the contract after PR is merged.

**The old contract will be marked as voided and won't cause any issues.**
