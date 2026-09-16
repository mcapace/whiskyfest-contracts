-- Run this SQL query in Supabase to diagnose the QR code mismatch issue

-- Check Ca'Marcanda
SELECT 
  'Ca''Marcanda' as winery,
  id as contract_id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%Marcanda%'

UNION ALL

-- Check GAJA (not Ca'Marcanda, not Pieve)
SELECT 
  'GAJA' as winery,
  id as contract_id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%GAJA%'
  AND exhibitor_company_name NOT ILIKE '%Marcanda%'
  AND exhibitor_company_name NOT ILIKE '%Pieve%'

UNION ALL

-- Check Diamond Creek
SELECT 
  'Diamond Creek' as winery,
  id as contract_id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%Diamond Creek%'

UNION ALL

-- Check VIK
SELECT 
  'VIK' as winery,
  id as contract_id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%VIK%'

ORDER BY winery;

-- Expected results:
-- Ca'Marcanda should have: https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/
-- GAJA should have: https://wilsondaniels.com/winery/gaja/
-- 
-- If they have different URLs, the migration didn't apply correctly
-- 
-- Note the contract_id for each - this is what should be in the tracking URL:
-- The QR should go to: https://nywecontracts.winespectator.com/b/[contract_id]
