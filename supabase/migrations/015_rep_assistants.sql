-- Dept-head assistants: many-to-many mapping + seed

insert into sales_reps (name, email, sort_order, is_active)
values (
  'Jody Spitalnik',
  'jspitalnik@mshanken.com',
  (select coalesce(max(sort_order), 0) + 10 from sales_reps),
  true
)
on conflict (email) do update set is_active = excluded.is_active, name = excluded.name;

insert into app_users (email, role, is_active) values
  ('ebain@mshanken.com', 'sales_rep', false),
  ('kbrumley@mshanken.com', 'sales_rep', false)
on conflict (email) do nothing;

create table if not exists rep_assistants (
  id uuid primary key default gen_random_uuid(),
  assistant_email text not null,
  rep_id uuid not null references sales_reps(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assistant_email, rep_id)
);

create index if not exists rep_assistants_assistant_email_idx on rep_assistants(lower(assistant_email));
create index if not exists rep_assistants_rep_id_idx on rep_assistants(rep_id);

insert into rep_assistants (assistant_email, rep_id)
select 'ebain@mshanken.com', id from sales_reps
where email = 'mmorgenstern@mshanken.com'
on conflict (assistant_email, rep_id) do nothing;

insert into rep_assistants (assistant_email, rep_id)
select 'kbrumley@mshanken.com', id from sales_reps
where email = 'ssenatore@mshanken.com'
on conflict (assistant_email, rep_id) do nothing;

insert into rep_assistants (assistant_email, rep_id)
select 'kbrumley@mshanken.com', id from sales_reps
where email = 'jspitalnik@mshanken.com'
on conflict (assistant_email, rep_id) do nothing;

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
