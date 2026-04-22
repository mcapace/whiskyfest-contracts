-- Events team approval gate (columns, seed, index uses pending_events_review — runs after 013a)

alter table app_users
  add column if not exists is_events_team boolean not null default false;

update app_users
set is_events_team = true
where email in (
  'lmott@mshanken.com',
  'snolan@mshanken.com',
  'nmazza@mshanken.com',
  'talper@mshanken.com',
  'mcapace@mshanken.com',
  'jarcella@mshanken.com'
);

alter table contracts
  add column if not exists events_submitted_at timestamptz,
  add column if not exists events_approved_at timestamptz,
  add column if not exists events_approved_by text,
  add column if not exists events_approval_reason text,
  add column if not exists events_sent_back_at timestamptz,
  add column if not exists events_sent_back_by text,
  add column if not exists events_sent_back_reason text;

create index if not exists contracts_pending_events_review_idx
  on contracts (id)
  where status = 'pending_events_review';

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
