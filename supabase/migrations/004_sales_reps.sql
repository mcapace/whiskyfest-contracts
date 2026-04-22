-- =============================================================================
-- Migration 004: Sales reps
-- Adds sales_reps + contracts.sales_rep_id + view fields sales_rep_name/email.
-- Safe to re-run.
-- =============================================================================

create table if not exists sales_reps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null unique,
  is_active  boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_reps_active_idx on sales_reps (is_active, sort_order, name);

create or replace function update_sales_reps_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sales_reps_updated_at on sales_reps;
create trigger sales_reps_updated_at
before update on sales_reps
for each row execute procedure update_sales_reps_updated_at();

alter table sales_reps enable row level security;
drop policy if exists sales_reps_read on sales_reps;
create policy sales_reps_read on sales_reps for select using (true);

insert into sales_reps (name, email, sort_order) values
  ('Stephen Senatore',   'ssenatore@mshanken.com',    10),
  ('Alyssa Weiss',       'aweiss@mshanken.com',       20),
  ('Michael DiChiara',   'mdichiara@mshanken.com',    30),
  ('Jake Cohen',         'jcohen@mshanken.com',       40),
  ('Miriam Morgenstern', 'mmorgenstern@mshanken.com', 50)
on conflict (email) do nothing;

alter table contracts
  add column if not exists sales_rep_id uuid references sales_reps(id) on delete set null;

create index if not exists contracts_sales_rep_idx on contracts (sales_rep_id);

create or replace view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  (c.additional_brand_count * 30000) as additional_brand_fee_cents,
  (c.booth_count * c.booth_rate_cents) + (c.additional_brand_count * 30000) as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id;
