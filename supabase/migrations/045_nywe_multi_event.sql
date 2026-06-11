-- Multi-event / NYWE: per-event Google templates, workflow profiles, and NYWE seed event.

alter table public.events
  add column if not exists product_key text not null default 'whiskyfest',
  add column if not exists contract_template_profile text not null default 'whiskyfest',
  add column if not exists workflow_profile text not null default 'sales_rep',
  add column if not exists google_template_doc_id text,
  add column if not exists google_sponsorship_template_doc_id text,
  add column if not exists contract_document_label text not null default 'Contract';

comment on column public.events.product_key is
  'Product line key, e.g. whiskyfest or wine_spectator — used for branding and defaults.';
comment on column public.events.contract_template_profile is
  'Merge/PDF profile: whiskyfest (table + tokens) or nywe_vendor (vendor license agreement).';
comment on column public.events.workflow_profile is
  'sales_rep = standard rep workflow; events_managed = events team creates/sends without a rep.';
comment on column public.events.google_template_doc_id is
  'Per-event Google Doc for booth/vendor PDFs; falls back to GOOGLE_TEMPLATE_DOC_ID env when null.';
comment on column public.events.contract_document_label is
  'Human label for generated PDFs and DocuSign subjects, e.g. Contract or License Agreement.';

-- Backfill existing WhiskyFest rows.
update public.events
set
  product_key = 'whiskyfest',
  contract_template_profile = 'whiskyfest',
  workflow_profile = 'sales_rep',
  contract_document_label = coalesce(nullif(trim(contract_document_label), ''), 'Contract')
where product_key = 'whiskyfest'
  and contract_template_profile = 'whiskyfest';

-- Wine Spectator New York Wine Experience 2026 (booth / vendor license @ $14,000).
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
  'New York Wine Experience 2026',
  'New York Wine Experience',
  'New York, NY',
  '2026-10-22'::date,
  'New York Marriott Marquis, 1535 Broadway, New York, NY 10036',
  2026,
  1400000,
  'Susannah Nolan',
  'Director, Events',
  'snolan@mshanken.com',
  true,
  'wine_spectator',
  'nywe_vendor',
  'events_managed',
  '1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw',
  'License Agreement'
where not exists (
  select 1 from public.events e
  where e.product_key = 'wine_spectator' and e.year = 2026
);
