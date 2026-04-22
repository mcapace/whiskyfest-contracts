-- Re-expand contracts_with_totals so `c.*` includes columns added after the view was last
-- created (e.g. discount_approved_* from 009_discount_approval.sql).
-- Postgres does not automatically add new base-table columns to an existing view.
--
-- `CREATE OR REPLACE VIEW` fails when `c.*` gains columns: output column order/names at
-- each position no longer match the old view (error 42P16). Must drop and recreate.

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
