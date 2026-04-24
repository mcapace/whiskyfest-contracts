-- Exhibitor-provided billing + event contact (DocuSign text tabs → webhook → contracts).
-- billing_address_* columns already exist (014_billing_address.sql); rep no longer fills them at draft.

alter table public.contracts
  add column if not exists billing_contact_name text null,
  add column if not exists billing_contact_email text null,
  add column if not exists event_contact_name text null,
  add column if not exists event_contact_email text null,
  add column if not exists exhibitor_fields_captured_at timestamptz null;

comment on column public.contracts.billing_contact_name is 'Designated billing contact name; captured from exhibitor DocuSign text tabs.';
comment on column public.contracts.billing_contact_email is 'Designated billing contact email; captured from exhibitor DocuSign text tabs.';
comment on column public.contracts.event_contact_name is 'Optional on-site / event contact; exhibitor DocuSign.';
comment on column public.contracts.event_contact_email is 'Optional event contact email; exhibitor DocuSign.';
comment on column public.contracts.exhibitor_fields_captured_at is 'When webhook persisted exhibitor billing/event tab values (after first signer completes).';
