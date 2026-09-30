-- Reassign the NYWE Gallo license to Lon Gallagher (signer + primary/event contact + billing contact).
--
-- Prefer the script, which also fixes the linked Google Sheets roster row:
--   npx tsx scripts/reassign-nywe-gallo-contract-to-lon.mts
--
-- If you run this SQL instead (Supabase SQL Editor), you MUST also edit the roster row by hand
-- (see REASSIGN_NYWE_GALLO_CONTRACT_TO_LON.md) — the portal re-pulls the sheet on Generate/Send
-- and would put Emma Bovberg back.

-- 1) Preview
SELECT
  id,
  status,
  exhibitor_company_name,
  exhibitor_legal_name,
  signer_1_name,
  signer_1_email,
  event_contact_name,
  event_contact_email,
  billing_contact_name,
  billing_contact_email,
  source_sheet_tab,
  source_row_number
FROM contracts
WHERE id = 'd21e327c-c85e-450d-8785-bc0dab9362e6';  -- consolidated Gallo license (recalled 2026-09-30)

-- 2) Update (only while not sent/signed — DocuSign owns the signer once an envelope is out;
--    for a 'sent' contract use "Resend with Changes" in the portal instead)
UPDATE contracts
SET
  signer_1_name         = 'Lon Gallagher',
  signer_1_email        = 'lon.gallagher@ejgallo.com',
  event_contact_name    = 'Lon Gallagher',
  event_contact_email   = 'lon.gallagher@ejgallo.com',
  billing_contact_name  = 'Lon Gallagher',
  billing_contact_email = 'lon.gallagher@ejgallo.com'
WHERE id = 'd21e327c-c85e-450d-8785-bc0dab9362e6'
  AND status NOT IN ('sent', 'partially_signed', 'signed', 'executed', 'voided', 'cancelled')
RETURNING id, status, signer_1_email, event_contact_email, billing_contact_email;

-- 3) Audit trail
INSERT INTO audit_log (contract_id, actor_email, action, metadata)
VALUES (
  'd21e327c-c85e-450d-8785-bc0dab9362e6',
  'mcapace@mshanken.com',
  'signer_contact_updated',
  jsonb_build_object(
    'source', 'REASSIGN_NYWE_GALLO_CONTRACT_TO_LON.sql',
    'new_email', 'lon.gallagher@ejgallo.com',
    'new_event_contact_email', 'lon.gallagher@ejgallo.com',
    'new_billing_contact_email', 'lon.gallagher@ejgallo.com'
  )
);
