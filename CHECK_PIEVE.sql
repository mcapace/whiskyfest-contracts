-- Check Pieve Santa Restituta URL
SELECT 
  id,
  exhibitor_company_name,
  exhibitor_website_url,
  rebrandly_short_url,
  rebrandly_link_id
FROM contracts
WHERE exhibitor_company_name ILIKE '%Pieve%';
