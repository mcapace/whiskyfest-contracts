-- Get essential details from one Gallo contract to replicate for Jermann

SELECT 
  id,
  event_id,
  exhibitor_company_name,
  exhibitor_legal_name,
  signer_1_name,
  signer_1_email,
  signer_1_title,
  event_contact_name,
  event_contact_email,
  billing_contact_name,
  billing_contact_email,
  billing_address_line1,
  billing_address_line2,
  billing_city,
  billing_state,
  billing_zip,
  billing_country,
  order_type,
  booth_count,
  booth_rate_cents,
  additional_brand_count,
  notes,
  package_key,
  package_selections
FROM contracts
WHERE id = 'ed8aab33-299e-43f1-9186-0ed68650f72c'  -- Louis M. Martini
LIMIT 1;
