-- WhiskyFest participation pipeline: pending renewals + new business inquiries.
-- Confirmed section is live from executed contracts (not stored here).

create table if not exists public.wf_pipeline_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  section text not null check (section in ('pending_renewal', 'new_business')),
  company_name text not null,
  sales_rep_id uuid references public.sales_reps(id) on delete set null,
  brands_text text,
  booth_count integer not null default 0,
  rate_per_booth_cents integer not null default 0,
  sponsorship_cents integer not null default 0,
  total_spend_cents integer not null default 0,
  notes text,
  linked_contract_id uuid references public.contracts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wf_pipeline_targets_company_nonempty check (length(trim(company_name)) > 0)
);

create unique index if not exists wf_pipeline_targets_event_section_company_uidx
  on public.wf_pipeline_targets (event_id, section, lower(trim(company_name)))
  where is_active = true;

create index if not exists wf_pipeline_targets_event_section_idx
  on public.wf_pipeline_targets (event_id, section)
  where is_active = true;

create index if not exists wf_pipeline_targets_linked_contract_idx
  on public.wf_pipeline_targets (linked_contract_id)
  where linked_contract_id is not null;

comment on table public.wf_pipeline_targets is
  'WhiskyFest participation report rows for pending renewals (prior year) and new-business inquiries. Confirmed = executed contracts.';
