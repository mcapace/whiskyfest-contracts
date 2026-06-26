# Deployment

## Initial setup (first-time contributor)

1. Create required accounts/access:
   - Vercel
   - Supabase
   - Google Cloud project access
   - DocuSign developer/production access
2. Clone repo and install dependencies.
3. Configure Supabase:
   - Create project
   - Apply `supabase/schema.sql`
   - Apply migrations from `supabase/migrations` in ascending numeric order
   - Ensure storage bucket `contract-pdfs` exists and is private
4. Configure Google Cloud:
   - Create service account (for Docs/Drive/Sheets access)
   - Enable APIs: Google Docs API, Google Drive API, Google Sheets API
   - Download service account JSON and base64 encode it for env usage
5. Configure DocuSign:
   - Create integration key (JWT Grant)
   - Generate/register RSA keypair
   - Grant consent
   - Validate in demo, then complete Go-Live to production
6. Configure Google Workspace assets:
   - Shared Drive for contracts
   - Template doc
   - Draft/signed/archive folder conventions
   - Grant service account content-manager/editor rights
7. Deploy to Vercel:
   - Import repo
   - Add env vars (below)
   - Deploy and validate smoke checks

## NYWE portal domain (`nywecontracts.winespectator.com`)

The NYWE vendor licenses portal runs on the **same Vercel deployment** as WhiskyFest, with a second custom domain. Middleware rewrites clean paths on the NYWE host:

| Browser URL (NYWE host) | Internal route |
| --- | --- |
| `/` | `/wine-spectator` (dashboard) |
| `/roster` | `/wine-spectator/roster` |
| `/contracts`, `/contracts/*` | `/wine-spectator/contracts/*` |
| `/accounting` | `/accounting/nywe` |
| `/accounting/{id}` | `/accounting/{id}` (shared contract detail) |

WhiskyFest-only paths (`/sales-reps`, `/events`, etc.) redirect to `/` on the NYWE host. Visiting `/wine-spectator/*` on the WhiskyFest host redirects to the NYWE domain with clean paths.

### Portal independence

Each hostname behaves as its own product surface:

| | WhiskyFest domain | NYWE domain |
| --- | --- | --- |
| Dashboard | WF pipeline | NYWE licenses |
| Contracts / roster | WF contracts | NYWE licenses + roster |
| Accounting | WhiskyFest AR only | NYWE AR only |
| Events admin | WhiskyFest events only | NYWE events only |
| Users / sponsors / import | Yes | Blocked (redirect) |
| Cross-links in UI | None to NYWE | None to WhiskyFest |

Users with access to **only one** product are redirected to the correct domain. **Admins** can use both domains (separate login sessions per domain). Contract search API results are scoped to the current domain's product.

### DNS + Vercel

1. In Vercel → Project → Settings → Domains, add `nywecontracts.winespectator.com`.
2. In DNS (Wine Spectator), add a **CNAME** for `nywecontracts` pointing to Vercel (`cname.vercel-dns.com` or the target Vercel shows).
3. Wait for SSL provisioning; confirm both domains resolve to the same deployment.

### Google OAuth

In Google Cloud Console → OAuth client → Authorized redirect URIs, add:

`https://nywecontracts.winespectator.com/api/auth/callback/google`

Keep the existing WhiskyFest redirect URI (`https://wacontracts.whiskyadvocate.com/api/auth/callback/google` or your `NEXTAUTH_URL`).

### Optional env vars

| Name | Description |
| --- | --- |
| `NYWE_PORTAL_HOST` | NYWE hostname (default: `nywecontracts.winespectator.com`) |
| `NYWE_PORTAL_ORIGIN` | Full origin for NYWE email/deep links |
| `WHISKYFEST_PORTAL_HOST` | WhiskyFest hostname (default: `wacontracts.whiskyadvocate.com`) |
| `WHISKYFEST_PORTAL_ORIGIN` | Full origin for WhiskyFest email/deep links (falls back to `NEXTAUTH_URL`) |

## Environment variables

| Name | Description | Example | Required | Service |
| --- | --- | --- | --- | --- |
| `NEXTAUTH_URL` | Base URL for auth callbacks | `https://whiskyfest-contracts.vercel.app` | Yes | NextAuth |
| `AUTH_SECRET` | NextAuth encryption/signing secret | `base64-random` | Yes | NextAuth |
| `GOOGLE_CLIENT_ID` | OAuth client id for user login | `123.apps.googleusercontent.com` | Yes | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `***` | Yes | Google OAuth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` | Yes | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key | `eyJ...` | Yes | Supabase |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64 JSON for service account | `ewogICJ0eXBlIj...` | Yes | Google APIs |
| `GOOGLE_TEMPLATE_DOC_ID` | Source template doc id | `1AbC...` | Yes | Google Docs |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Shared Drive root/folder id for wf files | `0A...` | Yes | Google Drive |
| `SHEETS_TRACKER_ID` | Team tracker spreadsheet id | `1Def...` | Optional (recommended) | Google Sheets |
| `SHEETS_TRACKER_TAB` | Sheet tab name | `Contracts` | Optional (recommended) | Google Sheets |
| `DOCUSIGN_INTEGRATION_KEY` | JWT app client id | `88dc...` | Yes | DocuSign |
| `DOCUSIGN_USER_ID` | User GUID to impersonate via JWT | `eaf4...` | Yes | DocuSign |
| `DOCUSIGN_ACCOUNT_ID` | Target account GUID | `13c5...` | Yes | DocuSign |
| `DOCUSIGN_AUTH_URL` | OAuth base | `https://account.docusign.com` | Yes | DocuSign |
| `DOCUSIGN_BASE_URL` | Fallback REST API base | `https://www.docusign.net/restapi` | Yes (fallback) | DocuSign |
| `DOCUSIGN_RSA_PRIVATE_KEY` | Base64-encoded private key | `LS0tLS1CRUdJTi...` | Yes | DocuSign |
| `DOCUSIGN_CONNECT_HMAC_SECRET` | Connect HMAC secret for webhook verification | `gxdMU...` | Yes | DocuSign |
| `SENDGRID_API_KEY` | API key for email delivery | `SG.xxx` | Yes | SendGrid |
| `SENDGRID_FROM_EMAIL` | Sender email | `wfcontracts@whiskyadvocate.com` | Yes | SendGrid |

## Production vs demo DocuSign

Use demo for development and validation, then promote via DocuSign Go-Live. The app resolves the REST API base dynamically from `/oauth/userinfo` after JWT token acquisition. This prevents environment drift and was the key fix for `USER_AUTHENTICATION_FAILED` errors caused by static/incorrect base URL targeting.

## Migration strategy

- All migrations live in `supabase/migrations/`
- Run in ascending order
- Prefer forward-only migrations in production
- Do not edit applied historical migration files; add new migration files for changes

## Deployment checklist

- Build succeeds (`npm run build`)
- Type checks pass (`npm run typecheck`)
- Auth works for `@mshanken.com`
- PDF generation + storage flow works
- DocuSign send + webhook status progression works
- Accounting release and invoice transitions work
