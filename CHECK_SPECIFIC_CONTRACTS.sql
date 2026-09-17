-- Check the specific contract IDs that Danielle reported issues with

SELECT 
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  google_drive_pdf_id,
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

-- Check if any of these share the same google_drive_pdf_id
SELECT 
  google_drive_pdf_id,
  COUNT(*) as contract_count,
  STRING_AGG(exhibitor_company_name, ' + ') as wineries
FROM contracts
WHERE id IN (
  '0aa0a007-ed35-4fd6-827d-db6674a1d221',
  '07b66351-77ce-48f8-b761-ab8e3e1ea1d8',
  '09b4fb7e-287b-4502-95ea-cf827dc6b1fe',
  '37ae92dc-7bfe-41ea-a253-c58f6bd53a78'
)
GROUP BY google_drive_pdf_id
HAVING COUNT(*) > 1;
