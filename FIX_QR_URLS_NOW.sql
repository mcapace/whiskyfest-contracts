-- URGENT FIX: Update the correct contract records with Wilson Daniels URLs
-- Based on diagnostic results showing duplicate GAJA contracts and wrong URLs

-- Fix Ca'Marcanda: Update contract 7ac8dd90-bc91-4754-9c2c-f466c058084b
-- This is the one with the QR code (rebrandly_short_url: winespectator.live/nywe26-ca-marcanda)
UPDATE contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/'
WHERE id = '7ac8dd90-bc91-4754-9c2c-f466c058084b';

-- Fix GAJA: Update contract a7d410ad-849a-4689-a98b-0de7a8278b8e
-- This is the one with the QR code (rebrandly_short_url: winespectator.live/nywe26-gaja)
-- Currently has VIK website, needs Wilson Daniels
UPDATE contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/winery/gaja/'
WHERE id = 'a7d410ad-849a-4689-a98b-0de7a8278b8e';

-- Verify the fix worked:
SELECT 
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url
FROM contracts
WHERE id = '7ac8dd90-bc91-4754-9c2c-f466c058084b'
   OR id = 'a7d410ad-849a-4689-a98b-0de7a8278b8e';

-- Expected results after running:
-- Ca'Marcanda → https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/
-- Gaja → https://wilsondaniels.com/winery/gaja/
