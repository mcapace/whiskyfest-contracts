# Reassign the NYWE Gallo license to Lon Gallagher

**Goal:** everything on the NYWE Gallo license goes to **Lon Gallagher — lon.gallagher@ejgallo.com**
(DocuSign signer, primary/event contact, billing contact).

**Contract:** `d21e327c-c85e-450d-8785-bc0dab9362e6` — the single consolidated Gallo license
(recalled on 2026-09-30, now in draft). It is linked to the Massican/GALLO row on the
**NYWE GT 2026 — RSVP & Wine Proposal (NEW) (Responses)** sheet, where the primary contact,
billing contact, and contract representative are all still **Emma Bovberg**.

## Why the sheet matters

The portal re-pulls the linked roster row on every **Generate PDF** and **Send**
(`lib/nywe-roster-contract-sync.ts`). Changing only the database would be overwritten with
Emma's details on the next send. Both the sheet row and the contract row have to change.

## Option A — run the script (does both)

```bash
cd whiskyfest-contracts
npx vercel env pull .env.local                # once; needs Supabase + Google service-account vars
npx tsx scripts/reassign-nywe-gallo-contract-to-lon.mts --dry-run   # preview
npx tsx scripts/reassign-nywe-gallo-contract-to-lon.mts --actor mcapace@mshanken.com
```

The script:

1. Verifies the linked sheet row still carries this contract's ID.
2. Writes Lon / Gallagher / lon.gallagher@ejgallo.com into the row's
   PRIMARY CONTACT, BILLING CONTACT, and CONTRACT REPRESENTATIVE name/email columns.
3. Updates `signer_1_*`, `event_contact_*`, `billing_contact_*` on the contract and adds an
   `audit_log` entry.

Flags: `--contract-id <uuid>` for a different license, `--skip-sheet` / `--skip-db`.

## Option B — by hand

1. **Roster sheet** — open the NEW responses sheet, find the row with CONTRACT ID
   `d21e327c-…` (winery "Massican", billing company "GALLO"), and set:
   - PRIMARY CONTACT FIRST / LAST / EMAIL → Lon / Gallagher / lon.gallagher@ejgallo.com
   - BILLING CONTACT FIRST / LAST / EMAIL → Lon / Gallagher / lon.gallagher@ejgallo.com
   - CONTRACT REPRESENTATIVE FIRST / LAST / EMAIL ADDRESS → Lon / Gallagher / lon.gallagher@ejgallo.com
2. **Database** — run `REASSIGN_NYWE_GALLO_CONTRACT_TO_LON.sql` in the Supabase SQL Editor
   (or just do step 3: the send refreshes signer/contacts from the sheet while the contract is in draft).

## Then send it

Open https://nywecontracts.winespectator.com/contracts/d21e327c-c85e-450d-8785-bc0dab9362e6
and click **Send**. The PDF is re-rendered with Lon's details and the DocuSign envelope goes to
lon.gallagher@ejgallo.com.

If the contract is already **sent** again when you get to this, use **Resend with Changes**
(signer: Lon Gallagher / lon.gallagher@ejgallo.com) instead — it voids the old envelope and
sends a new one; the sheet edit above still needs to happen so contacts stay correct.
