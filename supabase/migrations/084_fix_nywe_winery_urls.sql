-- Fix typos in NYWE winery website URLs for QR codes
-- Based on Tobi's feedback about QR code destinations in the tasting book

-- Fix NYWE winery URLs per Susannah Nolan (Sept 16, 2026)

-- Adriano Ramos Pinto - English version
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.ramospinto.pt/en/'
WHERE (exhibitor_company_name ILIKE '%Ramos Pinto%' OR exhibitor_company_name ILIKE '%Adriano Ramos%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%ramospinto%');

-- Merum Priorati - English version (was Pere Ventura typo)
UPDATE public.contracts
SET exhibitor_website_url = 'http://merumpriorati.com/en/'
WHERE (exhibitor_company_name ILIKE '%Merum%' OR exhibitor_company_name ILIKE '%Priorati%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%ventrura%'
    OR exhibitor_website_url LIKE '%pereventura%'
    OR exhibitor_website_url LIKE '%merum%');

-- Col d'Orcia - English version (.it not .com)
UPDATE public.contracts
SET exhibitor_website_url = 'https://coldorcia.it/en/home'
WHERE (exhibitor_company_name ILIKE '%Col%Orcia%' OR exhibitor_company_name ILIKE '%Coldorcia%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%coldorcia%');

-- Brancaia - English version
UPDATE public.contracts
SET exhibitor_website_url = 'https://brancaia.com/en/'
WHERE exhibitor_company_name ILIKE '%Brancaia%'
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%brancaia%');

-- CVNE - English version
UPDATE public.contracts
SET exhibitor_website_url = 'https://cvne.com/en/'
WHERE (exhibitor_company_name ILIKE '%CVNE%' OR exhibitor_company_name ILIKE '%Compañía Vinícola%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%cvne%');

-- Tensley - no www
UPDATE public.contracts
SET exhibitor_website_url = 'https://tensleywines.com/'
WHERE exhibitor_company_name ILIKE '%Tensley%'
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%tensleywines%');

-- Ca'Marcanda - Wilson Daniels importer page
UPDATE public.contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/'
WHERE (exhibitor_company_name ILIKE '%Ca''Marcanda%' OR exhibitor_company_name ILIKE '%Camarcanda%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%camarcanda%');

-- GAJA - Wilson Daniels importer page
UPDATE public.contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/winery/gaja/'
WHERE exhibitor_company_name ILIKE '%GAJA%'
  AND exhibitor_company_name NOT ILIKE '%Ca''Marcanda%'
  AND exhibitor_company_name NOT ILIKE '%Pieve%'
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%gaja%');

-- Pieve Santa Restituta - Wilson Daniels importer page
UPDATE public.contracts
SET exhibitor_website_url = 'https://wilsondaniels.com/winery/pieve-santa-restituta/'
WHERE (exhibitor_company_name ILIKE '%Pieve Santa Restituta%' OR exhibitor_company_name ILIKE '%Pieve%Restituta%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%pieve%');

-- Paolo Scavino - Skurnik importer page (winery site has broken TLS)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.skurnik.com/producer/paolo-scavino/'
WHERE (exhibitor_company_name ILIKE '%Paolo Scavino%' OR exhibitor_company_name ILIKE '%Scavino%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url LIKE '%scavino%');

-- Beronia - site is completely down, set to NULL so it can be updated when available
UPDATE public.contracts
SET exhibitor_website_url = NULL
WHERE exhibitor_company_name ILIKE '%Beronia%'
  AND (exhibitor_website_url LIKE '%beronia%');
