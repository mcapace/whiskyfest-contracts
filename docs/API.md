# API Reference

All endpoints are implemented as Next.js route handlers under `app/api`.

## Contracts

### `POST /api/contracts`
- **Permissions**: authenticated pipeline actors (admin/events/sales/assistant scopes)
- **Body**: contract draft fields
- **Response**: created contract row
- **Side effects**: audit trail entry via DB trigger

### `GET /api/contracts`
- **Permissions**: authenticated
- **Behavior**: returns role-scoped list

### `GET /api/contracts/[id]`
- **Permissions**: must have scoped access to contract

### `PATCH /api/contracts/[id]`
- **Permissions**: scoped editor roles; blocked during read-only impersonation

### `POST /api/contracts/[id]/generate`
- **Alias in product language**: generate PDF
- **Permissions**: scoped editor roles
- **Side effects**: renders template, uploads PDF to Supabase Storage and Drive backup, updates status/path columns

### `POST /api/contracts/[id]/events-approve`
- **Permissions**: events team/admin
- **Side effects**: status transition to approved

### `POST /api/contracts/[id]/events-send-back`
- **Permissions**: events team/admin
- **Side effects**: returns contract to draft or review-required stage

### `POST /api/contracts/[id]/send`
- **Permissions**: send-eligible staff for scoped contract
- **Side effects**: DocuSign envelope creation, metadata persistence, audit logging

### `POST /api/contracts/[id]/resend-with-changes`
- **Permissions**: send-eligible staff
- **Side effects**: adjusts data and re-sends envelope flow

### `POST /api/contracts/[id]/send-reminder`
- **Permissions**: staff with send control

### `POST /api/contracts/[id]/recall`
- **Permissions**: staff with send control

### `POST /api/contracts/[id]/release`
- **Permissions**: events team/admin
- **Side effects**: marks executed, accounting visibility, email + sheets updates

### `POST /api/contracts/[id]/cancel`
- **Permissions**: staff roles with status control
- **Side effects**: status change + tracker updates

### `POST /api/contracts/[id]/void`
- **Permissions**: admin/events
- **Body**: void reason
- **Side effects**: DocuSign void call, `voided` status fields, notifications, sheets update, audit

### `GET /api/contracts/[id]/pdf?variant=draft|signed`
- **Permissions**: role-aware contract PDF access rules
- **Response**: signed URL redirect or payload for storage-backed PDF
- **Fallback**: legacy Google Drive links for older records

## Accounting

### `PATCH /api/accounting/contracts/[id]`
- **Permissions**: accounting/admin
- **Body**:
  - `mark_invoice_sent: true`
  - `mark_paid: true`
  - `accounting_notes: string`
- **Side effects**: invoice status fields + optional notifications

## Webhooks

### `POST /api/webhooks/docusign`
- **Source**: DocuSign Connect
- **Security**: HMAC verification against `DOCUSIGN_CONNECT_HMAC_SECRET`
- **Behavior**: updates contract status progression, stores signed PDF, updates sheets

## Admin

### `GET /api/admin/cleanup-drive-temps?dryRun=true|false`
- **Permissions**: admin only
- **Behavior**: lists/deletes orphaned temp Google Docs in configured drive scope

### `GET /api/impersonation/candidates`
- **Permissions**: users with `can_impersonate=true`
- **Response**: segmented users for View As menu

## Users / Auth

### `GET /api/users`
- **Permissions**: admin
- **Response**: app users list

### `PATCH /api/users`
- **Permissions**: admin
- **Behavior**: update role/active flags

### `PATCH /api/users/me`
- **Permissions**: authenticated
- **Body**: tour completion fields (`tour_completed`, `tour_last_role`)

### `GET /api/auth/[...nextauth]`
- NextAuth-managed endpoints (session, callbacks, sign-in/out)

## Sales reps and events

- `GET /api/sales-reps`
- `PATCH /api/sales-reps/[id]`
- `GET /api/sales-reps/me`
- `GET /api/sales-reps/accessible`
- `GET/POST/PATCH /api/events` and `/api/events/[id]`

## Error conventions

- `401` unauthorized (no active session or inactive user)
- `403` authenticated but not permitted for requested action
- `404` resource not visible/does not exist in caller scope
- `400` validation errors / illegal state transitions
- `500` integration or persistence failures
