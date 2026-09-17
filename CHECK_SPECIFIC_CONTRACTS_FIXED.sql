-- Check the specific contract IDs that Danielle reported issues with

SELECT 
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  draft_pdf_drive_id,
  signed_pdf_drive_id,
  docusign_envelope_id,
  executed_at,
  created_at
FROM contracts
WHERE id IN (
  '0aa0a007-ed35-4fd6-827d-db6674a1d221',  -- Allegrini
  '07b66351-77ce-48f8-b761-ab8e3e1ea1d8',  -- Fontodi
  '09b4fb7e-287b-4502-95ea-cf827dc6b1fe',  -- Château Pichon Longueville Comtesse de Lalande
  '37ae92dc-7bfe-41ea-a253-c58f6bd53a78'   -- First Drop Wines
)
ORDER BY exhibitor_company_name;

-- Check if Allegrini and Fontodi share the same PDF IDs
SELECT 
  'Allegrini + Fontodi PDF Check' as check_type,
  draft_pdf_drive_id,
  signed_pdf_drive_id,
  COUNT(*) as contract_count,
  STRING_AGG(exhibitor_company_name, ' + ') as wineries
FROM contracts
WHERE id IN (
  '0aa0a007-ed35-4fd6-827d-db6674a1d221',  -- Allegrini
  '07b66351-77ce-48f8-b761-ab8e3e1ea1d8'   -- Fontodi
)
GROUP BY draft_pdf_drive_id, signed_pdf_drive_id
HAVING COUNT(*) > 1;

-- Check if Château Pichon and First Drop share the same PDF IDs
SELECT 
  'Château Pichon + First Drop PDF Check' as check_type,
  draft_pdf_drive_id,
  signed_pdf_drive_id,
  COUNT(*) as contract_count,
  STRING_AGG(exhibitor_company_name, ' + ') as wineries
FROM contracts
WHERE id IN (
  '09b4fb7e-287b-4502-95ea-cf827dc6b1fe',  -- Château Pichon
  '37ae92dc-7bfe-41ea-a253-c58f6bd53a78'   -- First Drop
)
GROUP BY draft_pdf_drive_id, signed_pdf_drive_id
HAVING COUNT(*) > 1;
