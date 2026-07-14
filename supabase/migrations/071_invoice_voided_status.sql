-- Voided invoice status for AR: cancel a sent invoice without returning to pending.

alter table public.contracts drop constraint if exists contracts_invoice_status_chk;
alter table public.contracts add constraint contracts_invoice_status_chk
  check (invoice_status in ('pending', 'invoice_sent', 'paid', 'not_invoiced', 'invoice_voided'));

comment on column public.contracts.invoice_status is
  'AR lifecycle: pending → invoice_sent → paid; not_invoiced (do not bill); invoice_voided (sent invoice cancelled).';
