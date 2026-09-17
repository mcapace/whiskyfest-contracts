-- Investigation: Contract Display Mismatches for NYWE 2026
-- Issues reported by Danielle Bixler:
-- 1. Allegrini showing Fontodi contract
-- 2. Château Pichon showing First Drop contract
-- 3. Jermann appearing under wrong portal

-- =================================================================
-- PART 1: Check Allegrini and Fontodi
-- =================================================================

SELECT 
  'Allegrini' as search,
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  docusign_envelope_id,
  google_drive_pdf_id,
  created_at,
  executed_at
FROM contracts
WHERE exhibitor_company_name ILIKE '%Allegrini%'
   OR exhibitor_legal_name ILIKE '%Allegrini%'
ORDER BY created_at DESC;

SELECT 
  'Fontodi' as search,
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  docusign_envelope_id,
  google_drive_pdf_id,
  created_at,
  executed_at
FROM contracts
WHERE exhibitor_company_name ILIKE '%Fontodi%'
   OR exhibitor_legal_name ILIKE '%Fontodi%'
ORDER BY created_at DESC;

-- =================================================================
-- PART 2: Check Château Pichon and First Drop
-- =================================================================

SELECT 
  'Château Pichon' as search,
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  docusign_envelope_id,
  google_drive_pdf_id,
  created_at,
  executed_at
FROM contracts
WHERE exhibitor_company_name ILIKE '%Pichon%'
   OR exhibitor_legal_name ILIKE '%Pichon%'
ORDER BY created_at DESC;

SELECT 
  'First Drop' as search,
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  docusign_envelope_id,
  google_drive_pdf_id,
  created_at,
  executed_at
FROM contracts
WHERE exhibitor_company_name ILIKE '%First Drop%'
   OR exhibitor_legal_name ILIKE '%First Drop%'
ORDER BY created_at DESC;

-- =================================================================
-- PART 3: Check Jermann and Portal Assignment
-- =================================================================

SELECT 
  'Jermann' as search,
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  portal_host,
  docusign_envelope_id,
  created_at
FROM contracts
WHERE exhibitor_company_name ILIKE '%Jermann%'
   OR exhibitor_legal_name ILIKE '%Jermann%'
ORDER BY created_at DESC;

-- Check what portal Stag's Leap is using
SELECT DISTINCT portal_host
FROM contracts
WHERE exhibitor_company_name ILIKE '%Stag%Leap%';

-- =================================================================
-- PART 4: Check All Gallo Wineries (5 missing)
-- =================================================================

SELECT 
  'Gallo Wineries' as search,
  exhibitor_company_name,
  exhibitor_legal_name,
  status,
  id,
  created_at,
  executed_at
FROM contracts
WHERE exhibitor_company_name IN (
  'Louis M. Martini',
  'Massican',
  'Pahlmeyer',
  'Rombauer',
  'Jermann'
)
OR exhibitor_company_name ILIKE '%Louis%Martini%'
OR exhibitor_company_name ILIKE '%Massican%'
OR exhibitor_company_name ILIKE '%Pahlmeyer%'
OR exhibitor_company_name ILIKE '%Rombauer%'
OR exhibitor_company_name ILIKE '%Jermann%'
ORDER BY exhibitor_company_name, created_at DESC;

-- =================================================================
-- DIAGNOSTIC: Look for potential ID swaps
-- =================================================================

-- Check if any contracts share the same DocuSign envelope ID (shouldn't happen)
SELECT 
  docusign_envelope_id,
  COUNT(*) as count,
  STRING_AGG(exhibitor_company_name, ', ') as wineries
FROM contracts
WHERE docusign_envelope_id IS NOT NULL
  AND docusign_envelope_id != ''
GROUP BY docusign_envelope_id
HAVING COUNT(*) > 1;

-- Check if any contracts share the same Google Drive PDF ID (shouldn't happen)
SELECT 
  google_drive_pdf_id,
  COUNT(*) as count,
  STRING_AGG(exhibitor_company_name, ', ') as wineries
FROM contracts
WHERE google_drive_pdf_id IS NOT NULL
  AND google_drive_pdf_id != ''
GROUP BY google_drive_pdf_id
HAVING COUNT(*) > 1;

-- =================================================================
-- EXPECTED RESULTS TO INVESTIGATE:
-- =================================================================
-- 
-- 1. If Allegrini and Fontodi have the same google_drive_pdf_id,
--    that's why viewing Allegrini shows Fontodi's contract
-- 
-- 2. If Château Pichon and First Drop have the same google_drive_pdf_id,
--    that's why viewing Château Pichon shows First Drop's contract
-- 
-- 3. If Jermann has portal_host that doesn't match expected,
--    that explains the "Stag's Leap" portal assignment
-- 
-- 4. Check Gallo contracts for actual execution status
