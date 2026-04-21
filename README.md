# WhiskyFest Contracts

End-to-end contract management for WhiskyFest participation agreements. Internal tool for M. Shanken Communications, restricted to `@mshanken.com` accounts.

**Stack**: Next.js 14 (App Router) · Supabase (Postgres) · Google Drive/Docs API · NextAuth · Tailwind · shadcn/ui · Vercel

## What it does

1. **Intake** — sales team enters closed WhiskyFest deals via a purpose-built form
2. **Generate** — a Google Docs template is merged with deal terms and exported as PDF
3. **Review** — draft PDF files to Google Drive for internal approval
4. **Send** — on approval, contract is sent via DocuSign with anchor-tag signer placement *(Phase 2)*
5. **Execute** — signed PDF auto-files to Drive + accounting gets a summary email *(Phase 2)*

Phase 1 ships steps 1–3. Phase 2 adds DocuSign + accounting handoff.

## Architecture

```
┌─────────────────────────────────────┐
│  Next.js 14 on Vercel               │
│  whiskyfest-contracts.vercel.app    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────────┐
       │                   │
┌──────▼───────┐   ┌───────▼──────────┐
│  Supabase    │   │  Vercel API      │
│  Postgres    │   │  routes          │
│  - contracts │   │  /api/contracts  │
│  - events    │   │  /api/.../       │
│  - audit_log │   │    generate      │
│  - app_users │   │    approve       │
└──────────────┘   │    send (P2)     │
                   │  /api/webhooks   │
                   │    /docusign (P2)│
                   └────┬─────────────┘
                        │
              ┌─────────┼──────────┐
              │         │          │
          ┌───▼───┐ ┌──▼────┐ ┌───▼─────┐
          │Google │ │DocuSign│ │SendGrid │
          │Drive+ │ │ (P2)  │ │  (P2)   │
          │Docs   │ │       │ │         │
          └───────┘ └───────┘ └─────────┘
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/mcapace/whiskyfest-contracts.git
cd whiskyfest-contracts
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a new project at [supabase.com](https://supabase.com) — name it `whiskyfest-contracts`
2. Once provisioned, go to **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (under Project API keys) → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Google OAuth (for login)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
2. **APIs & Services → OAuth consent screen** → configure as Internal (for `mshanken.com` workspace)
3. **APIs & Services → Credentials** → Create OAuth 2.0 Client ID (Web application)
4. Authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://whiskyfest-contracts.vercel.app/api/auth/callback/google`
5. Copy Client ID and Secret into `.env.local`

### 4. Google Service Account (for Drive/Docs API)

This is separate from OAuth — it's how the app generates PDFs as itself, not as a user.

1. Same Cloud project → **APIs & Services → Library** → enable both:
   - Google Drive API
   - Google Docs API
2. **IAM & Admin → Service Accounts** → Create service account (e.g. `whiskyfest-pdf-gen`)
3. After creation, click it → **Keys** tab → Add key → JSON → download
4. Base64-encode the JSON file:
   ```bash
   base64 -i service-account-key.json | pbcopy    # macOS
   base64 service-account-key.json                 # Linux
   ```
5. Paste as `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env.local`
6. **Critical**: share the template Doc and both Drive folders with the service account's email (found in the JSON's `client_email` field) with **Editor** access

### 5. NextAuth secret

```bash
openssl rand -base64 32
```

Paste as `AUTH_SECRET` in `.env.local`.

### 6. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with your `@mshanken.com` Google account. You should land on an empty dashboard.

### 7. Test the end-to-end flow

1. Click **New Contract**
2. Fill in test data:
   - Event: WhiskyFest New York — November 20, 2026
   - Legal Name: `Sample Distillery Inc.`
   - Company: `Sample Distillery`
   - Booth Count: 2, Additional Brands: 1
   - Signer: Jane Sampleson, VP Marketing, jane@sampledistillery.com
3. Verify the live total shows **$30,300**
4. Click **Create Contract** → redirects to detail page
5. Click **Generate Draft PDF** → waits a few seconds → reloads with `Ready for Review` status + draft PDF link
6. Open the PDF → verify all merge tokens replaced, math correct, Liz Mott's block present
7. Click **Approve for Sending** → status moves to `Approved`
8. With Phase 2 env vars configured, click **Send via DocuSign** (see `docs/INSTALL_PHASE2.md`)

## Deploy to Vercel

```bash
# Push to GitHub first
git remote add origin git@github.com:mcapace/whiskyfest-contracts.git
git push -u origin main
```

Then in [Vercel](https://vercel.com):

1. **Add New Project** → Import the GitHub repo
2. Framework preset: Next.js (auto-detected)
3. Environment variables: paste everything from `.env.local`, but change:
   - `NEXTAUTH_URL` → `https://whiskyfest-contracts.vercel.app` (or your custom domain)
4. Deploy
5. After first deploy, add the production redirect URI to Google OAuth (step 3 above)

## Phase 2 additions (DocuSign + SendGrid)

**Setup guide:** [`docs/INSTALL_PHASE2.md`](docs/INSTALL_PHASE2.md) (Connect webhook URL, env vars, Supabase migration). **SendGrid only:** [`SENDGRID_SETUP.md`](SENDGRID_SETUP.md) (replaces any Resend section from older zips).

Summary:

1. DocuSign Integration Key + RSA keypair (JWT Grant) + consent
2. All DocuSign + SendGrid env vars in `.env.local` and Vercel
3. Run `supabase/migrations/002_phase2_docusign.sql` if needed
4. DocuSign Connect → `https://whiskyfest-contracts.vercel.app/api/webhooks/docusign` (JSON payload)

## Project structure

```
app/
  (dashboard)/           Authenticated routes (sidebar layout)
    page.tsx             Dashboard — pipeline view
    contracts/
      new/page.tsx       New contract form
      [id]/page.tsx      Contract detail
  api/
    auth/                NextAuth handlers
    contracts/           CRUD + actions
      route.ts           POST — create
      [id]/
        generate/        Generate draft PDF
        approve/         Mark approved
        send/            (Phase 2) DocuSign send
    webhooks/
      docusign/          (Phase 2) Connect webhook
  auth/login/            Login page
components/
  ui/                    Primitives (button, card, input, table, badge, select)
  contracts/             Feature components (form, actions, status badge)
  layout/                Sidebar, nav
lib/
  auth.ts                NextAuth config — @mshanken.com gate
  supabase.ts            Server Supabase client
  google.ts              Drive/Docs API — PDF generation
  utils.ts               Formatting helpers (currency, dates, cn)
supabase/
  schema.sql             Full schema, triggers, seed data
types/
  db.ts                  TS types mirroring schema
```

## Notable design decisions

- **All money stored in cents (integer)** — avoids float precision issues
- **Computed totals via a Postgres view** (`contracts_with_totals`) — DB is the single source of truth for math; UI just displays
- **Audit log is append-only** — every status change is logged via a trigger, with no way to edit/delete history
- **Service role key bypasses RLS** — RLS is enabled for defense-in-depth but auth is enforced at the app layer via middleware + NextAuth
- **Service account for Drive/Docs, not OAuth** — the app generates PDFs as itself, not impersonating users. Cleaner audit, no user-token refresh headaches
- **Signature anchors are merge tokens, not hardcoded** — lets Phase 1 show blank signature lines and Phase 2 swap in DocuSign anchor tags without editing the template

## Admin tasks

### Add a new user

Users with `@mshanken.com` accounts are auto-provisioned as `sales` role on first login. To promote to admin:

```sql
update app_users set role = 'admin' where email = 'colleague@mshanken.com';
```

### Add a new event (next year's WhiskyFest, or a different city)

```sql
insert into events (name, tagline, location, event_date, venue, year)
values ('WhiskyFest San Francisco', 'WHISKY, TEQUILA, & BEYOND', 'SAN FRANCISCO',
        '2026-10-15', 'Marriott Marquis SF', 2026);
```

Or build an admin UI for this — `app/events/page.tsx` is scaffolded but not implemented. Low priority until you need a second event.

### Cancel or reset a contract

```sql
update contracts set status = 'cancelled' where id = '...';
```

Soft-cancel preferred over delete — preserves the audit trail.

## Troubleshooting

**"PDF generation failed — insufficient permissions"**
→ The service account doesn't have Editor access to the template Doc or Drafts folder. Share them with the service account's email.

**"All merge tokens in the PDF show as literal `{{token}}`"**
→ Google Docs split tokens across formatting runs during manual edits. Open the template, Ctrl+F each token. If any aren't found, retype them as plain text.

**"Sign-in fails with 'AccessDenied'"**
→ Your Google account isn't `@mshanken.com`, or the OAuth app isn't configured as Internal to the workspace.

**"Supabase queries return empty arrays but no errors"**
→ RLS is enabled and your query is using the anon key. Server code must use the service role key (via `getSupabaseAdmin()`).

## Open questions / future work

- [ ] Legal review of the 2025 contract boilerplate before bulk sending
- [ ] Build admin UI for managing events (currently SQL-only)
- [ ] Build admin UI for managing users (currently SQL-only)
- [ ] Cancel/void flow with a reason field
- [ ] Bulk operations (e.g. approve multiple at once)
- [ ] Email notifications to signers when contract is sent
- [ ] Reminder cadence for unsigned contracts
- [ ] Export pipeline data to CSV for reporting
- [ ] Dashboard filters (by status, event, date range)
- [x] Phase 2: DocuSign integration (`send` route + REST JWT, webhook)
- [x] Phase 2: Accounting handoff email (SendGrid)
- [ ] Phase 2: Slack webhook for executed contracts

## License

Proprietary — M. Shanken Communications. Internal use only.
