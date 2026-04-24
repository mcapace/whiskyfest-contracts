# Permissions Model

## Roles and flags (`app_users`)

- `role`: `admin`, `sales`, `viewer`, `sales_rep` (project uses `sales` for most rep users)
- `is_events_team`: can review/approve/send-back/release and perform other events functions
- `is_accounting`: can access accounting dashboard and invoice actions
- `can_impersonate`: enables View As menu and read-only impersonation mode
- `is_active`: hard gate for app access

## Permission matrix

| Action | Admin | Events | Sales Rep | Assistant | Accounting |
| --- | --- | --- | --- | --- | --- |
| View all contracts | ✓ | ✓ | Own only | Scoped | Executed only |
| Create contract | ✓ | ✓ | ✓ | ✓ | ✗ |
| Approve contract | ✓ | ✓ | ✗ | ✗ | ✗ |
| Send via DocuSign | ✓ | ✓ | ✓ | ✓ | ✗ |
| Void contract | ✓ | ✓ | ✗ | ✗ | ✗ |
| Release to accounting | ✓ | ✓ | ✗ | ✗ | ✗ |
| Mark invoice sent/paid | ✓ | ✗ | ✗ | ✗ | ✓ |
| Impersonate users | If flagged | ✗ | ✗ | ✗ | ✗ |

## Scoping rules

- **Sales rep**: sees contracts where `contracts.sales_rep_id` maps to the user email in `sales_reps`.
- **Assistant**: sees contracts for reps linked in `rep_assistants` by `assistant_email`.
- **Accounting**: works from executed contracts and invoice lifecycle fields.
- **Events team + admin**: broad visibility across contract pipeline.

## Impersonation model

- Only `can_impersonate=true` users can impersonate.
- Impersonation is read-only (`session.is_read_only_impersonation=true`).
- Actions are blocked in mutating APIs when impersonating.
- Audit events capture impersonation start/end.
- Session auto-expires after ~30 minutes.

## Storage/PDF access model

- Contract PDF files are private in Supabase Storage.
- Read access uses signed URLs and a DB permission function (`user_can_read_contract_pdf`) that evaluates role + contract scope.
