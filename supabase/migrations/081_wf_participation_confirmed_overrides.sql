-- Kate-owned overrides for Confirmed participation rows (booth / separately billed amounts).
-- Confirmed companies still come from executed contracts; sheet booths merge at report time.
-- These overrides are never overwritten by Google Sheets sync.

create table if not exists public.wf_participation_confirmed_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  -- When set, replaces sheet + contract booth count on the participation report.
  booth_count_override integer check (booth_count_override is null or booth_count_override >= 0),
  -- Extra dollars billed outside the executed contract (e.g. separate $30k invoice).
  additional_spend_cents integer not null default 0 check (additional_spend_cents >= 0),
  -- When set, replaces contract grand total + additional entirely.
  total_spend_override_cents integer check (total_spend_override_cents is null or total_spend_override_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wf_participation_confirmed_overrides_contract_uidx unique (contract_id)
);

create index if not exists wf_participation_confirmed_overrides_event_idx
  on public.wf_participation_confirmed_overrides (event_id);

comment on table public.wf_participation_confirmed_overrides is
  'Manual participation adjustments for executed WhiskyFest contracts (booth override, separately billed amounts).';
