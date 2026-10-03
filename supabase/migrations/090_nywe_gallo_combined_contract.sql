-- NYWE Gallo brands share one vendor license. covered_wineries lists each winery
-- on that contract; booth_count is the winery count and the license total is
-- booth_count × the NYWE license fee.

alter table public.contracts
  add column if not exists covered_wineries jsonb;

comment on column public.contracts.covered_wineries is
  'NYWE wineries covered by one combined license (Gallo). Each entry is {winery_name, website_url, wine_display, source_rows}.';

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
