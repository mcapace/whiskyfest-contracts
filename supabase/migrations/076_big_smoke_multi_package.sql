-- Big Smoke: allow multiple rate-sheet packages on one contract (e.g. Double + Single = 3 booths).

alter table public.contracts
  add column if not exists package_selections jsonb;

comment on column public.contracts.package_selections is
  'Big Smoke package lines: [{ "key": "cigar_ad_6plus_double", "qty": 1 }, ...]. Null/legacy rows use package_key only.';

-- Backfill single-package contracts into selections JSON.
update public.contracts
set package_selections = jsonb_build_array(jsonb_build_object('key', package_key, 'qty', 1))
where package_key is not null
  and package_key <> ''
  and (package_selections is null or package_selections = 'null'::jsonb or package_selections = '[]'::jsonb);

-- Re-expand view so c.* includes package_selections.
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
