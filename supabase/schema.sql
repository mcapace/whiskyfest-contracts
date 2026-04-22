-- =============================================================================
-- WhiskyFest Contracts — Supabase Schema
-- Run this once in the Supabase SQL Editor after creating your project.
-- Safe to re-run; uses IF NOT EXISTS where possible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

do $$ begin
  create type contract_status as enum (
    'draft',
    'ready_for_review',
    'approved',
    'sent',
    'partially_signed',
    'signed',
    'executed',
    'cancelled',
    'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'sales', 'viewer');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- EVENTS — one row per WhiskyFest event; contracts reference this
-- -----------------------------------------------------------------------------

create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                  -- "WhiskyFest New York"
  tagline         text,                            -- "WHISKY, TEQUILA, & BEYOND"
  location        text,                            -- "NEW YORK"
  event_date      date not null,                   -- 2026-11-20
  venue           text,                            -- "Marriott Marquis New York"
  year            int  not null,                   -- 2026
  booth_rate_cents int not null default 1500000,   -- $15,000 in cents
  shanken_signatory_name   text default 'Liz Mott',
  shanken_signatory_title  text default 'Vice President, Events',
  shanken_signatory_email  text default 'lmott@mshanken.com',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- CONTRACTS — the main pipeline table
-- All money fields stored in cents (integer) to avoid float precision issues.
-- -----------------------------------------------------------------------------

create table if not exists contracts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete restrict,
  status          contract_status not null default 'draft',

  -- Exhibitor
  exhibitor_legal_name    text not null,
  exhibitor_company_name  text not null,
  exhibitor_address_line1 text,
  exhibitor_address_line2 text,
  exhibitor_city          text,
  exhibitor_state         text,
  exhibitor_zip           text,
  exhibitor_country       text,
  exhibitor_telephone     text,
  brands_poured           text,

  -- Pricing (cents)
  booth_count             int not null default 1 check (booth_count > 0),
  booth_rate_cents        int not null,
  additional_brand_count  int not null default 0 check (additional_brand_count >= 0),

  -- Signer info
  signer_1_name           text,
  signer_1_title          text,
  signer_1_email          text,

  -- Generated artifacts
  draft_pdf_drive_id      text,
  draft_pdf_url           text,
  docusign_envelope_id    text,
  signed_pdf_drive_id     text,
  signed_pdf_url          text,

  -- Timestamps for each stage
  drafted_at              timestamptz,
  approved_at             timestamptz,
  sent_at                 timestamptz,
  signed_at               timestamptz,
  executed_at             timestamptz,
  accounting_notified_at  timestamptz,

  cancelled_reason        text,
  cancelled_at            timestamptz,
  cancelled_by            text,
  discount_approved_at    timestamptz,
  discount_approved_by    text,
  discount_approval_reason text,

  -- Audit
  created_by              text,        -- email of creator
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  notes                   text
);

create table if not exists sales_reps (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  is_active   boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sales_reps_active_idx on sales_reps (is_active, sort_order, name);
alter table contracts add column if not exists sales_rep_id uuid references sales_reps(id) on delete set null;
create index if not exists contracts_sales_rep_idx on contracts (sales_rep_id);
create index if not exists contracts_discount_pending_idx
  on contracts (id)
  where booth_rate_cents < 1500000 and discount_approved_at is null;

-- Computed-ish helpers (views make more sense than generated columns for totals)
create or replace view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents)                        as booth_subtotal_cents,
  0::int                                                      as additional_brand_fee_cents,
  (c.booth_count * c.booth_rate_cents)                        as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id;

-- -----------------------------------------------------------------------------
-- AUDIT LOG — immutable trail of status changes + key actions
-- -----------------------------------------------------------------------------

create table if not exists audit_log (
  id          bigserial primary key,
  contract_id uuid references contracts(id) on delete cascade,
  actor_email text,
  action      text not null,     -- 'created', 'status_changed', 'pdf_generated', etc.
  from_status contract_status,
  to_status   contract_status,
  metadata    jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_audit_contract on audit_log(contract_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- USERS — lightweight allowlist of @mshanken.com emails with roles
-- Auth is handled by NextAuth + Google, but we use this to gate the app.
-- -----------------------------------------------------------------------------

create table if not exists app_users (
  email       text primary key,
  name        text,
  role        user_role not null default 'sales',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Seed admin accounts (idempotent)
insert into app_users (email, name, role) values
  ('mcapace@mshanken.com',   'Michael Capace', 'admin'),
  ('lmott@mshanken.com',     'Liz Mott',       'admin'),
  ('ssenatore@mshanken.com', 'Stephen Senatore','admin')
on conflict (email) do nothing;

insert into sales_reps (name, email, sort_order) values
  ('Stephen Senatore',   'ssenatore@mshanken.com',    10),
  ('Alyssa Weiss',       'aweiss@mshanken.com',       20),
  ('Michael DiChiara',   'mdichiara@mshanken.com',    30),
  ('Jake Cohen',         'jcohen@mshanken.com',       40),
  ('Miriam Morgenstern', 'mmorgenstern@mshanken.com', 50)
on conflict (email) do nothing;

-- -----------------------------------------------------------------------------
-- TRIGGERS — updated_at + audit logging
-- -----------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_contracts_updated on contracts;
create trigger trg_contracts_updated
  before update on contracts
  for each row execute function set_updated_at();

drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated
  before update on events
  for each row execute function set_updated_at();

drop trigger if exists trg_sales_reps_updated on sales_reps;
create trigger trg_sales_reps_updated
  before update on sales_reps
  for each row execute function set_updated_at();

-- Status-change audit
create or replace function log_status_change() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into audit_log (contract_id, actor_email, action, from_status, to_status, metadata)
    values (new.id, current_setting('app.current_user_email', true), 'status_changed', old.status, new.status, null);
  elsif (tg_op = 'INSERT') then
    insert into audit_log (contract_id, actor_email, action, to_status, metadata)
    values (new.id, new.created_by, 'created', new.status, null);
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_contracts_audit on contracts;
create trigger trg_contracts_audit
  after insert or update on contracts
  for each row execute function log_status_change();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Enabled but permissive in Phase 1 — tighten per role in Phase 2.
-- App authenticates via service role key from Next.js server actions,
-- so RLS is enforced at the app layer for now.
-- -----------------------------------------------------------------------------

alter table contracts enable row level security;
alter table events    enable row level security;
alter table sales_reps enable row level security;
alter table audit_log enable row level security;
alter table app_users enable row level security;

-- Service role bypasses RLS; these permissive policies are for anon safety.
drop policy if exists deny_anon_contracts on contracts;
create policy deny_anon_contracts on contracts for all to anon using (false);

drop policy if exists deny_anon_events on events;
create policy deny_anon_events on events for all to anon using (false);

drop policy if exists sales_reps_read on sales_reps;
create policy sales_reps_read on sales_reps for select using (true);
drop policy if exists deny_anon_sales_reps on sales_reps;
create policy deny_anon_sales_reps on sales_reps for all to anon using (false);

drop policy if exists deny_anon_audit on audit_log;
create policy deny_anon_audit on audit_log for all to anon using (false);

drop policy if exists deny_anon_users on app_users;
create policy deny_anon_users on app_users for all to anon using (false);

-- -----------------------------------------------------------------------------
-- SEED — WhiskyFest NYC 2026 event + a test contract
-- -----------------------------------------------------------------------------

insert into events (name, tagline, location, event_date, venue, year)
values (
  'WhiskyFest New York',
  'WHISKY, TEQUILA, & BEYOND',
  'NEW YORK',
  '2026-11-20',
  'Marriott Marquis New York',
  2026
)
on conflict do nothing;
