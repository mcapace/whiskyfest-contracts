-- Accounting layer: invoice tracking + AR users

alter table contracts
  add column if not exists invoice_status text not null default 'pending',
  add column if not exists invoice_sent_at timestamptz,
  add column if not exists invoice_sent_by text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by text,
  add column if not exists accounting_notes text;

alter table contracts
  drop constraint if exists contracts_invoice_status_chk;

alter table contracts
  add constraint contracts_invoice_status_chk
  check (invoice_status in ('pending', 'invoice_sent', 'paid'));

create index if not exists contracts_status_invoice_status_idx
  on contracts (status, invoice_status);

create index if not exists contracts_invoice_status_idx
  on contracts (invoice_status);

alter table app_users
  add column if not exists is_accounting boolean not null default false;

-- Seed AR users (inactive until enabled for rollout)
insert into app_users (email, name, role, is_accounting, is_active)
values
  ('accountsreceivable@mshanken.com', 'AR Team', 'viewer', true, false),
  ('dbixler@mshanken.com', 'Danielle Bixler', 'viewer', true, false)
on conflict (email) do update set
  name = excluded.name,
  is_accounting = excluded.is_accounting;

drop view if exists contracts_with_totals;

create view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  (c.booth_count * c.booth_rate_cents) as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id;
