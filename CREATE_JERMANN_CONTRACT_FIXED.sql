-- Create Jermann contract for Gallo with same terms as other 4 Gallo contracts

INSERT INTO contracts (
  event_id,
  status,
  exhibitor_company_name,
  exhibitor_legal_name,
  signer_1_name,
  signer_1_email,
  event_contact_name,
  event_contact_email,
  billing_contact_name,
  billing_contact_email,
  billing_address_line1,
  billing_city,
  billing_state,
  billing_zip,
  billing_same_as_corporate,
  order_type,
  booth_count,
  booth_rate_cents,
  additional_brand_count,
  no_charge_booth,
  revision_round,
  qr_clicks,
  revision_use_uploaded_pdf,
  invoice_status
) VALUES (
  '2e931b63-3851-4602-8acc-fc2a8c3d6755',  -- Same event as other Gallo contracts
  'draft',
  'Jermann',
  'GALLO',
  'Lon Gallagher',
  'lon.gallagher@ejgallo.com',
  'Emma Bovberg',
  'emma.bovberg@ejgallo.com',
  'Emma Bovberg',
  'emma.bovberg@ejgallo.com',
  '600 Yosemite Blvd',
  'Modesto',
  'CA',
  '95354',
  false,
  'booth',
  1,
  1400000,  -- $14,000.00
  0,
  false,
  0,
  0,
  false,
  'pending'  -- Valid invoice status
)
RETURNING id, exhibitor_company_name, status;
