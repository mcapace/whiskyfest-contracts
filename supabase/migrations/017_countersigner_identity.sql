-- Persist actual Shanken countersigner (signing-group member who signed)

alter table contracts
  add column if not exists countersigned_by_email text,
  add column if not exists countersigned_by_name text,
  add column if not exists countersigned_at timestamptz;

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
