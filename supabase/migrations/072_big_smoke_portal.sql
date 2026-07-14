-- Big Smoke product line: portal admin flag + seed Big Smoke Las Vegas 2026.

alter table public.app_users
  add column if not exists is_big_smoke_admin boolean not null default false;

comment on column public.app_users.is_big_smoke_admin is
  'Portal admin for Big Smoke / Cigar Aficionado (events settings + contract admin actions).';

-- Big Smoke Las Vegas 30th Anniversary — Fri Nov 6 & Sat Nov 7, 2026 · Horseshoe Las Vegas.
-- Pricing packages TBD (set booth_rate_cents / Google template once pricing sheet lands).
insert into public.events (
  name,
  tagline,
  location,
  event_date,
  venue,
  year,
  booth_rate_cents,
  shanken_signatory_name,
  shanken_signatory_title,
  shanken_signatory_email,
  is_active,
  product_key,
  contract_template_profile,
  workflow_profile,
  google_template_doc_id,
  contract_document_label
)
select
  'Big Smoke Las Vegas 2026',
  'Cigar Aficionado''s Big Smoke · 30th Anniversary',
  'Las Vegas, NV',
  '2026-11-06'::date,
  'Horseshoe Las Vegas',
  2026,
  0,
  'Susannah Nolan',
  'Director, Events',
  'snolan@mshanken.com',
  true,
  'big_smoke',
  'big_smoke',
  'events_managed',
  '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8',
  'Contract'
where not exists (
  select 1 from public.events e
  where e.product_key = 'big_smoke' and e.year = 2026 and e.name ilike '%Las Vegas%'
);
