# Send Jermann Contract to Lon Gallagher

**Contract Created:**
- Contract ID: `a0afb378-2ff5-4b2f-b64a-d0d37a9a44da`
- Winery: Jermann
- Status: draft
- Signer: Lon Gallagher (lon.gallagher@ejgallo.com)

---

## Next Steps:

### Option 1: Via Portal UI (Easiest)

1. Go to: https://nywecontracts.winespectator.com/contracts/a0afb378-2ff5-4b2f-b64a-d0d37a9a44da

2. Click **"Generate PDF"** button
   - Wait for PDF generation to complete

3. Click **"Send for Signature"** button
   - This will send the contract to Lon Gallagher via DocuSign
   - Email will go to: lon.gallagher@ejgallo.com

4. Done! Lon Gallagher will receive it along with the other 4 Gallo contracts

---

### Option 2: Via API (If portal doesn't work)

**Step 1: Generate PDF**
```bash
curl -X POST https://nywecontracts.winespectator.com/api/contracts/a0afb378-2ff5-4b2f-b64a-d0d37a9a44da/generate
```

**Step 2: Send to DocuSign**
```bash
curl -X POST https://nywecontracts.winespectator.com/api/contracts/a0afb378-2ff5-4b2f-b64a-d0d37a9a44da/send
```

(You'll need to be logged in as admin for these to work)

---

### Option 3: Via SQL (Check if needs generation)

```sql
-- Check current status
SELECT 
  id,
  exhibitor_company_name,
  status,
  drafted_at,
  sent_at,
  docusign_envelope_id
FROM contracts
WHERE id = 'a0afb378-2ff5-4b2f-b64a-d0d37a9a44da';
```

---

## What Will Happen:

1. **PDF Generation**: System will create the contract PDF with Jermann's details
2. **DocuSign Send**: Contract will be sent to lon.gallagher@ejgallo.com
3. **Status Update**: Contract status will change from 'draft' to 'sent'
4. **Lon's Email**: He'll receive DocuSign email to sign Jermann contract

---

## Email Response to Susannah:

```
Hi Susannah,

✓ Jermann contract created with same terms as the other Gallo contracts
  - Signer: Lon Gallagher (lon.gallagher@ejgallo.com)
  - Terms: 1 booth at $14,000
  - Billing: GALLO, 600 Yosemite Blvd, Modesto, CA

Contract ID: a0afb378-2ff5-4b2f-b64a-d0d37a9a44da

I'm about to send it to Lon Gallagher via DocuSign now. He'll receive all 5 Gallo contracts:
1. Louis M. Martini ✓
2. Massican ✓
3. Pahlmeyer ✓
4. Rombauer ✓
5. Jermann ✓ (just created)

Let me know once you want me to send it, or I can send it now.

Mike
```

---

## Recommended: Send it now

Just go to the portal link above and click:
1. "Generate PDF"
2. "Send for Signature"

That's it! Lon Gallagher will get the email.
