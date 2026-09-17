-- Get full details of one Gallo contract to use as template for Jermann

SELECT 
  id,
  exhibitor_company_name,
  exhibitor_legal_name,
  signer_1_name,
  signer_1_email,
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
  booth_size,
  pricing_tier,
  total,
  notes,
  internal_notes
FROM contracts
WHERE id = 'ed8aab33-299e-43f1-9186-0ed68650f72c'  -- Louis M. Martini
LIMIT 1;
