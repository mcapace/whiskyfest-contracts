-- Reassign the NYWE Gallo license (d21e327c-…) to Lon Gallagher and relink it to Lon's roster row.
--
-- Background (2026-09-30): the contract was linked to the Massican row (row 9) of the NEW responses
-- sheet, whose contacts are Emma Bovberg. The Rombauer row (row 11, same sheet, tab YES) now carries the
-- contract ID with Lon as signer / primary contact / billing contact. The portal re-pulls the LINKED row on
-- every contract-page load and every Send, so the link itself has to move to row 11.
-- Run in the Supabase SQL Editor.

-- 1) Inspect
SELECT
  id, status,
  exhibitor_company_name, exhibitor_legal_name,
  signer_1_name, signer_1_email,
  event_contact_name, event_contact_email,
  billing_contact_name, billing_contact_email,
  source_sheet_id, source_sheet_tab, source_row_number
FROM contracts
WHERE id = 'd21e327c-c85e-450d-8785-bc0dab9362e6';

-- 2) Relink to the Rombauer / Lon row and set every contact to Lon.
--    NEW responses sheet: 1IC_8cIQazLicQSw5GMcosUgttz56qqUrAVTHJCnYy6I, tab "YES", row 11.
--    If step 1 shows a different source_sheet_tab spelling for this same sheet, keep that spelling.
UPDATE contracts
SET
  source_sheet_id       = '1IC_8cIQazLicQSw5GMcosUgttz56qqUrAVTHJCnYy6I',
  source_sheet_tab      = COALESCE(NULLIF(source_sheet_tab, ''), 'YES'),
  source_row_number     = 11,
  signer_1_name         = 'Lon Gallagher',
  signer_1_email        = 'lon.gallagher@ejgallo.com',
  event_contact_name    = 'Lon Gallagher',
  event_contact_email   = 'lon.gallagher@ejgallo.com',
  billing_contact_name  = 'Lon Gallagher',
  billing_contact_email = 'lon.gallagher@ejgallo.com'
WHERE id = 'd21e327c-c85e-450d-8785-bc0dab9362e6'
  AND status NOT IN ('sent', 'partially_signed', 'signed', 'executed', 'voided', 'cancelled')
RETURNING id, status, signer_1_email, event_contact_email, billing_contact_email, source_row_number;

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
    'new_billing_contact_email', 'lon.gallagher@ejgallo.com',
    'relinked_to_row', 11
  )
);
