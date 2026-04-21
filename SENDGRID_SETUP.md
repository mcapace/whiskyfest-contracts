# SendGrid setup (accounting emails)

## How this fits the Phase 2 packages

This repo **already uses SendGrid** (`@sendgrid/mail` in `package.json`, `lib/email.ts`). There is **no Resend** dependency.

If you unpacked an older **wf-docusign** zip that assumed **Resend**, treat **wf-docusign-sendgrid** as a small patch:

1. Install the main Phase 2 / wf-docusign content first.
2. Overwrite from the SendGrid patch zip:
   - **`package.json`** — ensure `@sendgrid/mail` is present and `resend` is not.
   - **`lib/email.ts`** — SendGrid implementation (same pattern as this repo).

Everything else in **`docs/INSTALL_PHASE2.md`** still applies: DocuSign env vars, Connect webhook, testing flow, etc. The SendGrid-specific pieces are below.

---

## SendGrid account

### 1. API access

**If Shanken already has SendGrid**, get from ops / digital:

- API key with **Mail Send**
- Confirmation that **`mshanken.com`** is verified as a sender domain (or a single verified `from` address)

### 2. New account (if needed)

1. [sendgrid.com](https://sendgrid.com) — free tier is enough for this volume.
2. **Settings → Sender Authentication** — domain `mshanken.com` (DNS), **or** **Single Sender Verification** for e.g. `contracts@mshanken.com` for quick tests.

### 3. Create an API key

1. **Settings → API Keys** → **Create API Key**
2. **Restricted** → enable **Mail Send** only
3. Copy the key once (it won’t show again)

### 4. Vercel (and `.env.local`)

```bash
vercel env add SENDGRID_API_KEY production --sensitive
vercel env add SENDGRID_API_KEY preview --sensitive
vercel env add ACCOUNTING_FROM_EMAIL production
vercel env add ACCOUNTING_FROM_EMAIL preview
```

Use a verified **`ACCOUNTING_FROM_EMAIL`**. Set **`ACCOUNTING_EMAIL`** to the AP/billing recipient list (see `.env.example`).

### 5. Install locally

```bash
npm install
```

---

## Gotchas

1. **`from` must be verified** in SendGrid — otherwise 403.
2. **Activity Feed:** [app.sendgrid.com/email_activity](https://app.sendgrid.com/email_activity) if mail doesn’t arrive.
3. **Attachments** are base64 in the API — `lib/email.ts` already encodes the PDF correctly.
4. Free tier limits (e.g. 100 emails/day) are usually fine for this app.

---

## Full Phase 2

DocuSign, webhook URL, HMAC, Supabase migration: **`docs/INSTALL_PHASE2.md`**.
