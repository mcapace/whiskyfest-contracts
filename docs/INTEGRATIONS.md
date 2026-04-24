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
- **Config**: `GOOGLE_TEMPLATE_DOC_ID` + service account credentials.

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

## Supabase Storage

- **Why**: centralized private PDF storage with app-compatible signed URL access.
- **Bucket**: `contract-pdfs` (private)
- **Path pattern**: `{contract_id}/draft.pdf`, `{contract_id}/signed.pdf`
- **RLS policy**: function-based contract visibility checks.

## SendGrid

- **Why**: reliable transactional delivery.
- **Usage**: workflow notifications (release, void, cancel, accounting-relevant updates).
- **From address**: typically `wfcontracts@whiskyadvocate.com`.
