# Create Jermann Contract for Gallo

## Gallo Contract Details (from Louis M. Martini template):

**Signer:** Lon Gallagher (lon.gallagher@ejgallo.com)  
**Event Contact:** Emma Bovberg (emma.bovberg@ejgallo.com)  
**Billing Contact:** Emma Bovberg (emma.bovberg@ejgallo.com)  
**Legal Name:** GALLO  
**Address:** 600 Yosemite Blvd, Modesto, CA 95354

**Contract Terms:**
- Order Type: booth
- Booth Count: 1
- Booth Rate: $14,000.00
- Additional Brands: 0
- Event ID: 2e931b63-3851-4602-8acc-fc2a8c3d6755

---

## Option 1: Create via Portal (Recommended)

1. Go to: https://nywecontracts.winespectator.com/contracts/new

2. Fill in the form with:
   - **Winery Name**: Jermann
   - **Legal/Billing Name**: GALLO
   - **Signer Name**: Lon Gallagher
   - **Signer Email**: lon.gallagher@ejgallo.com
   - **Event Contact**: Emma Bovberg (emma.bovberg@ejgallo.com)
   - **Billing Contact**: Emma Bovberg (emma.bovberg@ejgallo.com)
   - **Billing Address**: 600 Yosemite Blvd, Modesto, CA 95354
   - **Booth Count**: 1
   - **Booth Rate**: $14,000

3. Add any notes if needed (the other Gallo contracts don't have notes)

4. Save and send to Lon Gallagher

---

## Option 2: Quick SQL Insert (If you prefer)

```sql
INSERT INTO contracts (
  id,
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
  invoice_status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
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
  'none',
  NOW(),
  NOW()
)
RETURNING id, exhibitor_company_name;
```

After running this, you'll get the contract ID. Then you can:
1. Generate the PDF
2. Send to Lon Gallagher via DocuSign

---

## Option 3: Add to Google Sheets Roster

If Jermann should be in the exhibitor roster:
1. Add Jermann to the Google Sheets with Gallo's details
2. Run roster sync
3. Contract will be created automatically

---

## After Creating the Contract:

1. **Generate PDF**: Go to the contract detail page and click "Generate PDF"
2. **Review**: Make sure all details match the other Gallo contracts
3. **Send to DocuSign**: Click "Send for Signature"
4. **Recipient**: Will automatically go to lon.gallagher@ejgallo.com

---

## Notes:

- All 5 Gallo contracts will have the same signer (Lon Gallagher)
- Same billing address for all
- Same booth rate ($14,000)
- Jermann will be part of the Gallo bundle that Jake is working on
