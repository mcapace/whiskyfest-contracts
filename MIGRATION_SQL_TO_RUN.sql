-- ============================================================
-- Migration 083: Fix Big Smoke Template Resolution
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- ============================================================

-- This migration fixes the issue where non-Las Vegas Big Smoke events
-- were incorrectly assigned the Las Vegas template.

-- Step 1: Clear the Las Vegas template from non-Las Vegas Big Smoke events
-- This ensures events don't inherit the wrong template by default
UPDATE public.events
SET google_template_doc_id = NULL
WHERE product_key = 'big_smoke'
  AND google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  AND NOT (year = 2026 AND name ILIKE '%Las Vegas%');

-- Step 2: Ensure Las Vegas 2026 specifically has the correct template
-- This guarantees the Las Vegas event always has the right template
UPDATE public.events
SET google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE product_key = 'big_smoke'
  AND year = 2026
  AND name ILIKE '%Las Vegas%'
  AND (
    google_template_doc_id IS NULL
    OR TRIM(google_template_doc_id) = ''
    OR google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  );

-- ============================================================
-- VERIFICATION QUERY (run this after the migration)
-- ============================================================
-- Uncomment the lines below to check the results:

-- SELECT 
--   id,
--   name,
--   year,
--   product_key,
--   contract_template_profile,
--   google_template_doc_id
-- FROM public.events
-- WHERE product_key = 'big_smoke'
-- ORDER BY year DESC, name;

-- ============================================================
-- Expected Results:
-- - Las Vegas 2026: google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
-- - Other Big Smoke events (if any): google_template_doc_id = NULL
-- ============================================================
