-- NYWE booth print art codes + booth numbers (from Lisa George / TOC sheet).

alter table public.contracts
  add column if not exists art_code text,
  add column if not exists booth_number text;

comment on column public.contracts.art_code is
  'NYWE print art code for booth QR file naming (from TOC / art-code sheet).';
comment on column public.contracts.booth_number is
  'NYWE tasting booth number from the TOC / art-code sheet.';

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
