-- Optional package key for Big Smoke (and future multi-package products).

alter table public.contracts
  add column if not exists package_key text;

comment on column public.contracts.package_key is
  'Product package key (e.g. Big Smoke cigar_ad_1_5_single). Null for WhiskyFest / flat NYWE licenses.';

-- Seed / refresh BSLV event default rate to non-advertiser single ($8,000) as a safe baseline.
update public.events
set booth_rate_cents = 800000
where product_key = 'big_smoke'
  and year = 2026
  and name ilike '%Las Vegas%';

-- Re-expand view so c.* includes package_key.
drop view if exists public.contracts_with_totals;

create view public.contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  coalesce(li.sub_cents, 0)::integer as line_items_subtotal_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as total_amount_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from public.contracts c
left join public.sales_reps sr on sr.id = c.sales_rep_id
left join (
  select contract_id, sum(amount_cents)::bigint as sub_cents
  from public.contract_line_items
  group by contract_id
) li on li.contract_id = c.id;