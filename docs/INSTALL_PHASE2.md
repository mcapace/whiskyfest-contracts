# Phase 2 — DocuSign + SendGrid

Follow in order: dependencies → env vars → Supabase migration → deploy → DocuSign Connect → SendGrid → test.

## 1. Dependencies

Already in `package.json`: `jsonwebtoken`, `@sendgrid/mail`. Install locally:

```bash
npm install
```

**Note:** We use the DocuSign **REST API** with `fetch` + JWT (not the `docusign-esign` npm package) because that SDK does not bundle cleanly with Next.js.

## 2. Environment variables

### DocuSign (already on Vercel for most teams)

| Variable | Example |
|----------|---------|
| `DOCUSIGN_INTEGRATION_KEY` | Apps and Keys → Integration Key |
| `DOCUSIGN_USER_ID` | Apps and Keys → User ID (GUID) |
| `DOCUSIGN_ACCOUNT_ID` | Apps and Keys → API Account ID |
| `DOCUSIGN_BASE_URL` | Demo: `https://demo.docusign.net/restapi` — Production: `https://www.docusign.net/restapi` |
| `DOCUSIGN_AUTH_URL` | Demo: `https://account-d.docusign.com` — Production: `https://account.docusign.com` |
| `DOCUSIGN_RSA_PRIVATE_KEY` | Base64 of `docusign-private-key.pem` (one line, no newlines) |

### Webhook HMAC (optional but recommended)

When you enable **Include HMAC Signature** on the Connect configuration, set the same secret in Vercel:

| Variable | Purpose |
|----------|---------|
| `DOCUSIGN_CONNECT_HMAC_SECRET` | Must match the secret configured in DocuSign Connect |

If this is unset, the app accepts any JSON payload (fine for local debugging only).

### SendGrid (accounting email on envelope completion)

| Variable | Purpose |
|----------|---------|
| `SENDGRID_API_KEY` | API key with Mail Send |
| `ACCOUNTING_EMAIL` | Comma-separated AP/billing addresses |
| `ACCOUNTING_FROM_EMAIL` | Verified sender (e.g. `contracts@mshanken.com`) |

SendGrid-only steps (patch order vs. Resend zips, API key, verified sender): **`SENDGRID_SETUP.md`** in the repo root.

### App URL (for links in accounting email)

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_URL` | e.g. `https://whiskyfest-contracts.vercel.app` |

## 3. Supabase migrations

Run in order in the Supabase SQL Editor:

1. **`supabase/migrations/002_phase2_docusign.sql`** — `partially_signed` enum + cancel columns (if missing).
2. **`supabase/migrations/003_exhibitor_structured_address.sql`** — street / apt / city / state / ZIP columns for exhibitor mailing address.

If the enum already has `partially_signed`, the `DO` block is a no-op.

## 4. Google Doc template anchors

Draft PDFs replace `{{sig_anchor_*}}` with blank lines. **DocuSign send** replaces them with literal anchor text so tabs land correctly:

- `{{sig_anchor_1}}` → `\s1\`
- `{{date_anchor_1}}` → `\d1\`
- `{{sig_anchor_2}}` → `\s2\`
- `{{date_anchor_2}}` → `\d2\`

These must exist in the master Google Doc as merge tokens (same as Phase 1).

## 5. DocuSign Connect (webhook)

1. DocuSign Admin → **Connect** → add configuration (JSON).
2. **URL:** `https://<your-domain>/api/webhooks/docusign`
3. Subscribe at minimum to:
   - **Envelope recipient completed** (exhibitor / routing order 1 → app sets `partially_signed`; Liz then receives the countersign invite from DocuSign)
   - **Envelope completed** (Liz + exhibitor done → `executed`, signed PDF to Drive, **accounting** + **sales rep** email — sales rep is the contract `created_by` user, CC’d if not already in `ACCOUNTING_EMAIL`)
4. Use **JSON** payload format (not XML), or the route will return 200 without updating data.
5. Optional: enable **HMAC** and set `DOCUSIGN_CONNECT_HMAC_SECRET` in Vercel to the same value.

**Consent URL:** If you use JWT Grant, ensure users have hit your consent URL once; the app includes `app/api/auth/callback/docusign/route.ts` so the redirect does not hit NextAuth by mistake.

## 6. Deploy

```bash
git push
```

Redeploy after changing env vars.

## 7. Testing checklist

1. Create contract → Generate draft PDF (blank-line anchors).
2. Approve → **Send via DocuSign** (PDF regenerated with `\s1\` … anchors).
3. Sign as exhibitor → status **Partially Signed** (webhook).
4. Sign as Shanken (event signatory, e.g. Liz) → **Executed**, signed PDF in Drive, accounting email + **CC to sales rep** (`created_by`) if SendGrid is configured.
5. Temporarily point Shanken signatory email at your own inbox to test both roles.

## 8. Troubleshooting

| Symptom | Check |
|--------|--------|
| OAuth / JWT errors | `DOCUSIGN_*` values, RSA base64, consent granted |
| Send returns 400 | Exhibitor `signer_1_email` and event `shanken_signatory_email` set |
| **No DocuSign “please sign” email** | Sequential routing: **only signer 1** (exhibitor) is emailed first; the countersigner is invited after exhibitor signs. Check spam, wrong email on contract/event, demo delays. |
| Webhook does nothing | Connect URL, JSON format, envelope tied to `docusign_envelope_id` |
| HMAC 401 | Secret mismatch or wrong header algorithm — verify against [DocuSign HMAC docs](https://developers.docusign.com/platform/webhooks/connect/validate/) |
| No **accounting** / **sales** email (SendGrid) | Sends only on **envelope completed** (both signers). Needs `SENDGRID_API_KEY`, verified `ACCOUNTING_FROM_EMAIL`. Sales rep CC uses `created_by` on the contract. |
