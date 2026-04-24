# Schema

## ER diagram

```mermaid
erDiagram
  app_users ||--o{ rep_assistants : assistant_email
  sales_reps ||--o{ rep_assistants : rep_id
  sales_reps ||--o{ contracts : sales_rep_id
  events ||--o{ contracts : event_id
  contracts ||--o{ audit_log : contract_id

  app_users {
    text email PK
    text role
    bool is_active
    bool is_events_team
    bool is_accounting
    bool can_impersonate
  }

  sales_reps {
    uuid id PK
    text email
    text name
    bool is_active
  }

  rep_assistants {
    uuid id PK
    text assistant_email
    uuid rep_id FK
  }

  events {
    uuid id PK
    text name
    date event_date
    int year
  }

  contracts {
    uuid id PK
    uuid event_id FK
    uuid sales_rep_id FK
    text status
    text pdf_storage_path
    text docusign_envelope_id
    timestamptz executed_at
  }

  audit_log {
    bigint id PK
    uuid contract_id FK
    text action
    timestamptz occurred_at
  }
```

## Tables

## `contracts`
- **Purpose**: central lifecycle record for each exhibitor contract
- **Key columns**: exhibitor info, signer/countersigner, status, amounts, DocuSign metadata, invoice fields, PDF storage path, void/cancel data
- **Indexes**: status/event/date and FK access patterns
- **RLS**: app enforces role access; storage access additionally constrained via policy function
- **FKs**: `event_id -> events.id`, `sales_rep_id -> sales_reps.id`

## `app_users`
- **Purpose**: access control + feature flags for authenticated users
- **Key columns**: `role`, `is_active`, `is_events_team`, `is_accounting`, `can_impersonate`, `theme_preference`, `tour_completed_at`, `tour_last_role`
- **Indexes**: email PK
- **RLS**: table protected; service role and app-layer auth used for administrative changes

## `sales_reps`
- **Purpose**: canonical sales rep directory and ownership mapping
- **Key columns**: `id`, `email`, `name`, `is_active`, sort metadata

## `rep_assistants`
- **Purpose**: maps assistants to one or more reps they support
- **Key columns**: `assistant_email`, `rep_id`
- **Indexes**: assistant lookup + rep lookup

## `events`
- **Purpose**: event catalog for contract assignment and reporting
- **Key columns**: event identity, date, venue, active flag

## `audit_log`
- **Purpose**: immutable action/status history
- **Key columns**: actor, action, from/to status, metadata payload, timestamp
- **FK**: `contract_id -> contracts.id`

## Views

## `contracts_with_totals`
- Denormalized read model for dashboard/list pages with computed totals and joined sales rep metadata.

## Storage schema notes

- Bucket: `contract-pdfs` (private)
- Object names: `{contract_id}/draft.pdf`, `{contract_id}/signed.pdf`
- RLS policy function: `user_can_read_contract_pdf(name text)`

## Migration history (chronological)

- `002_phase2_docusign.sql`: initial DocuSign phase additions
- `003_exhibitor_structured_address.sql`: structured exhibitor address fields
- `004_sales_reps.sql`: sales reps model
- `005_exhibitor_country.sql`: country fields
- `006_structured_address.sql`: structured address refinements
- `007_pricing_booth_only.sql`: pricing model updates
- `008_add_jennifer_admin.sql`: admin seed adjustment
- `009_discount_approval.sql`: discount approval model
- `010_contracts_view_refresh_discount_cols.sql`: view refresh for discount columns
- `011_user_role_sales_rep.sql`: role enum updates
- `012_audit_log_no_insert_trigger.sql`: audit trigger behavior updates
- `013a_add_pending_events_review_status.sql`: new contract status
- `013b_events_approval.sql`: events approval workflow fields/rules
- `014_billing_address.sql`: billing address support
- `015_rep_assistants.sql`: assistant scoping
- `016_restore_liz_email.sql`: data correction
- `017_countersigner_identity.sql`: countersigner identity fields
- `018_add_accounting_layer.sql`: accounting status and fields
- `019_add_impersonation.sql`: impersonation support
- `020_add_theme_preference.sql`: UI preference persistence
- `021_contract_pdfs_storage.sql`: Supabase Storage PDF path + storage policies
- `023_add_contract_void.sql`: void status and metadata fields
- `023_add_tour_tracking.sql`: onboarding tour completion tracking

> Note: baseline schema is also represented in `supabase/schema.sql`.
