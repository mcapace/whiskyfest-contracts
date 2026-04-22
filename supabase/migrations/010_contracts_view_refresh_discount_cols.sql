-- Re-expand contracts_with_totals so `c.*` includes columns added after the view was last
-- replaced (e.g. discount_approved_* from 009_discount_approval.sql).
-- Postgres does not automatically add new base-table columns to an existing view.

create or replace view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  (c.booth_count * c.booth_rate_cents) as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id;
