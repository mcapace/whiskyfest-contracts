-- Ordered fetch index + view column rename: line_items_subtotal_cents (sum of line items).

drop index if exists contract_line_items_contract_id_idx;

create index if not exists contract_line_items_contract_id_display_order_idx
  on public.contract_line_items (contract_id, display_order);

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
