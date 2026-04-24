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
