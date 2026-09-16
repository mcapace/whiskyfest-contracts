-- Fix typos in NYWE winery website URLs for QR codes
-- Based on Tobi's feedback about QR code destinations in the tasting book

-- Fix typo: www, → www. (Adriano Ramos Pinto)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.ramospinto.pt/'
WHERE exhibitor_website_url LIKE '%www,%'
  OR exhibitor_website_url LIKE '%ramospinto%'
  AND exhibitor_website_url LIKE '%www,%';

-- Fix typo: trura → tura (Merum Priorati / Pere Ventura)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.pereventura.com/'
WHERE exhibitor_website_url LIKE '%ventrura%'
  OR exhibitor_website_url LIKE '%pereventrura%';

-- Fix typo: .com → .it (Col d'Orcia)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.coldorcia.it/'
WHERE exhibitor_website_url LIKE '%coldorcia.com%';

-- Fix: www.beronia.com → beronia.com (without www, times out with www)
UPDATE public.contracts
SET exhibitor_website_url = 'https://beronia.com/'
WHERE exhibitor_website_url LIKE '%www.beronia.com%';

-- Fix: Brancaia URL (stale/bad URL)
UPDATE public.contracts
SET exhibitor_website_url = 'https://brancaia.com/'
WHERE (exhibitor_company_name ILIKE '%Brancaia%' OR exhibitor_company_name ILIKE '%Brancaia%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url LIKE '%brancaia.it%'
    OR exhibitor_website_url = '');

-- Fix: CVNE URL (bad/stale URL)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.cvne.com/'
WHERE (exhibitor_company_name ILIKE '%CVNE%' OR exhibitor_company_name ILIKE '%Compañía Vinícola%')
  AND (exhibitor_website_url IS NULL OR exhibitor_website_url = '');

-- Fix: Tensley URL (www.tensleywines.com SSL fails, use without www)
UPDATE public.contracts
SET exhibitor_website_url = 'https://tensleywines.com/'
WHERE exhibitor_website_url LIKE '%www.tensleywines.com%';

-- Fix: Ca'Marcanda (HTTPS cert broken, use HTTP)
UPDATE public.contracts
SET exhibitor_website_url = 'http://www.camarcanda.com/'
WHERE (exhibitor_company_name ILIKE '%Ca''Marcanda%' OR exhibitor_company_name ILIKE '%Camarcanda%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url LIKE '%https://www.camarcanda%'
    OR exhibitor_website_url = '');

-- Fix: GAJA (main site)
UPDATE public.contracts
SET exhibitor_website_url = 'https://www.gaja.com/'
WHERE exhibitor_company_name ILIKE '%GAJA%'
  AND exhibitor_company_name NOT ILIKE '%Ca''Marcanda%'
  AND exhibitor_company_name NOT ILIKE '%Pieve%'
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url = ''
    OR exhibitor_website_url NOT LIKE '%gaja.com%');

-- Fix: Pieve Santa Restituta (HTTPS cert broken, use HTTP)
UPDATE public.contracts
SET exhibitor_website_url = 'http://www.pievesantarestituta.com/'
WHERE (exhibitor_company_name ILIKE '%Pieve Santa Restituta%' OR exhibitor_company_name ILIKE '%Pieve%Restituta%')
  AND (exhibitor_website_url IS NULL 
    OR exhibitor_website_url LIKE '%https://www.pievesantarestituta%'
    OR exhibitor_website_url = '');

-- Note: Paolo Scavino site has broken TLS - no good URL available, leaving as-is
