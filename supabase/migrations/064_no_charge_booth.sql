-- Complimentary WhiskyFest booth workflow (Stephen Senatore / Katherine Brumley).

alter table public.contracts
  add column if not exists no_charge_booth boolean not null default false;

comment on column public.contracts.no_charge_booth is
  'WhiskyFest complimentary booth — $0 rate, skips discount approval, AR status not_invoiced.';

alter table public.contracts drop constraint if exists contracts_invoice_status_chk;
alter table public.contracts add constraint contracts_invoice_status_chk
  check (invoice_status in ('pending', 'invoice_sent', 'paid', 'not_invoiced'));
