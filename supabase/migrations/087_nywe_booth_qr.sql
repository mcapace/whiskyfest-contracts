-- NYWE booth QR codes: winery website + Rebrandly short link / scan cache.

alter table public.contracts
  add column if not exists exhibitor_website_url text,
  add column if not exists rebrandly_link_id text,
  add column if not exists rebrandly_short_url text,
  add column if not exists qr_clicks integer not null default 0,
  add column if not exists qr_last_click_at timestamptz,
  add column if not exists qr_clicks_synced_at timestamptz;

comment on column public.contracts.exhibitor_website_url is
  'NYWE winery website for booth QR destination (from roster or staff).';
comment on column public.contracts.rebrandly_link_id is
  'Rebrandly link id. Short URL is stable after first QR download.';
comment on column public.contracts.rebrandly_short_url is
  'Printed booth QR encodes this Rebrandly URL, not the winery website.';
comment on column public.contracts.qr_clicks is
  'Cached Rebrandly click count for the booth QR.';

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
