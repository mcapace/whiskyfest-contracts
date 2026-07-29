# Integrations

## DocuSign

- **Why**: legally binding signatures and enterprise workflow reliability.
- **Auth**: JWT Grant using integration key + RSA private key; app impersonates configured user.
- **Base URI strategy**: resolve from `/oauth/userinfo` dynamically, not static-only env assumptions.
- **Usage**: create/resend/recall/void envelopes; download signed docs; process Connect webhooks.
- **Security**: validate webhook signature with `DOCUSIGN_CONNECT_HMAC_SECRET`.
- **Environments**: demo for testing, production after Go-Live promotion.

## Google Docs

- **Why**: business-maintained contract template with merge tokens.
- **Flow**: copy template -> replace placeholders -> export as PDF.
- **Config**: `GOOGLE_TEMPLATE_DOC_ID` (booth deals), optional `GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID` (sponsorship-only — no booth row), plus service account credentials.
- **Sponsorship-only**: contracts with `order_type = sponsorship_only` use the sponsorship template when the env var is set. Line items are still inserted above a **GRAND TOTAL** row; DocuSign uses the same PDF anchor strings as the booth template.

## Google Drive

- **Why**: backup archive and operational recovery path.
- **Structure**: shared-drive folder strategy for template/drafts/signed archives.
- **Permissions**: service account requires content manager/editor on shared drive for full lifecycle (including deletes).
- **Cleanup**: temp docs are auto-deleted after export; admin cleanup endpoint exists for orphan recovery.

## Google Sheets

- **Why**: team tracker already used by operations.
- **Auth**: service account with sheet editor access.
- **Sync behavior**:
  - Partial-sign event appends row (if missing)
  - Signed/executed/cancelled/void updates existing row
- **Config**: `SHEETS_TRACKER_ID`, `SHEETS_TRACKER_TAB`

### Billed exhibitor export (accounting)

- **Why**: AR needs a shareable Google Sheet of all invoiced exhibitors (invoice sent + paid).
- **Products**: separate spreadsheets for WhiskyFest and NYWE (`WhiskyFest Billed Exhibitors`, `NYWE Billed Exhibitors`).
- **Trigger**: **Export billed to Google Sheets** on each accounting dashboard; auto-refreshes when AR marks invoice sent or paid.
- **Config**:
  - `GOOGLE_BILLED_EXPORT_FOLDER_ID` — Shared Drive folder (falls back to `GOOGLE_DRIVE_ROOT_FOLDER_ID`)
  - Optional fixed sheet IDs: `SHEETS_BILLED_WHISKYFEST_ID`, `SHEETS_BILLED_NYWE_ID`
  - Tab name: `SHEETS_BILLED_TAB` (default `Billed Exhibitors`)

## Supabase Storage

- **Why**: centralized private PDF storage with app-compatible signed URL access.
- **Bucket**: `contract-pdfs` (private)
- **Path pattern**: `{contract_id}/draft.pdf`, `{contract_id}/signed.pdf`
- **RLS policy**: function-based contract visibility checks.

## SendGrid

- **Why**: reliable transactional delivery.
- **Usage**: workflow notifications (release, void, cancel, invoice sent/paid, etc.).
- **From address** (by `product_key`):
  - WhiskyFest → `wfcontracts@whiskyadvocate.com` (or `WHISKYFEST_FROM_EMAIL`)
  - NYWE → `nywecontracts@winespectator.com` (or `WINE_SPECTATOR_FROM_EMAIL` / `NYWE_FROM_EMAIL`)
  - Big Smoke → `bigsmokecontracts@cigaraficionado.com` (or `BIG_SMOKE_FROM_EMAIL`)
- **Routing** (`lib/notification-routing.ts`): each notification type resolves recipients explicitly — no blanket “email the whole events team” for events-managed portals.
  - **WhiskyFest** (`sales_rep`): invoice sent/paid → assigned sales rep (assistants CC when configured).
  - **NYWE & Big Smoke** (`events_managed`): invoice sent/paid → ops inbox (`NYWE_OPS_NOTIFICATION_EMAILS`, else `EVENTS_MANAGED_INVOICE_NOTIFICATION_EMAILS`); fallback `created_by`. NYWE skips partial/fully-signed app mail (DocuSign / auto-release).
  - **Env**: `NYWE_OPS_NOTIFICATION_EMAILS`, `EVENTS_MANAGED_INVOICE_NOTIFICATION_EMAILS`, `NYWE_EVENTS_REVIEW_EMAILS`, `NOTIFICATION_EXCLUDED_EMAILS`.
- **Docs**: [PORTALS.md](./PORTALS.md), [ACCOUNTING.md](./ACCOUNTING.md).
