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
    'pending_events_review',
    'approved',
    'sent',
    'partially_signed',
    'signed',
    'executed',
    'voided',
    'cancelled',
    'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'sales', 'sales_rep', 'viewer');
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
  pdf_storage_path        text,
  docusign_envelope_id    text,
  signed_pdf_drive_id     text,
  signed_pdf_url          text,

  -- Timestamps for each stage
  drafted_at              timestamptz,
  approved_at             timestamptz,
  sent_at                 timestamptz,
  signed_at               timestamptz,
  countersigned_by_email  text,
  countersigned_by_name   text,
  countersigned_at        timestamptz,
  executed_at             timestamptz,
  accounting_notified_at  timestamptz,

  cancelled_reason        text,
  cancelled_at            timestamptz,
  cancelled_by            text,
  voided_at               timestamptz,
  voided_by               text,
  voided_reason           text,
  discount_approved_at    timestamptz,
  discount_approved_by    text,
  discount_approval_reason text,

  -- Audit
  created_by              text,        -- email of creator
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  notes                   text
);

alter table contracts add column if not exists events_submitted_at timestamptz;
alter table contracts add column if not exists events_approved_at timestamptz;
alter table contracts add column if not exists events_approved_by text;
alter table contracts add column if not exists events_approval_reason text;
alter table contracts add column if not exists events_sent_back_at timestamptz;
alter table contracts add column if not exists events_sent_back_by text;
alter table contracts add column if not exists events_sent_back_reason text;

alter table contracts add column if not exists pdf_storage_path text;

alter table contracts add column if not exists billing_same_as_corporate boolean not null default true;
alter table contracts add column if not exists billing_address_line1 text;
alter table contracts add column if not exists billing_address_line2 text;
alter table contracts add column if not exists billing_city text;
alter table contracts add column if not exists billing_state text;
alter table contracts add column if not exists billing_zip text;
alter table contracts add column if not exists billing_country text;

alter table contracts add column if not exists billing_contact_name text;
alter table contracts add column if not exists billing_contact_email text;
alter table contracts add column if not exists event_contact_name text;
alter table contracts add column if not exists event_contact_email text;
alter table contracts add column if not exists exhibitor_fields_captured_at timestamptz;

alter table contracts add column if not exists countersigned_by_email text;
alter table contracts add column if not exists countersigned_by_name text;
alter table contracts add column if not exists countersigned_at timestamptz;

create index if not exists contracts_pending_events_review_idx
  on contracts (id)
  where status = 'pending_events_review';

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

-- Optional per-contract charges (sponsorships, activations, etc.)
create table if not exists contract_line_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount_cents integer not null check (amount_cents >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_line_items_contract_id_display_order_idx
  on contract_line_items (contract_id, display_order);

-- Accounting / AR (mirrors migration 018_add_accounting_layer.sql)
alter table contracts add column if not exists invoice_status text not null default 'pending';
alter table contracts add column if not exists invoice_sent_at timestamptz;
alter table contracts add column if not exists invoice_sent_by text;
alter table contracts add column if not exists paid_at timestamptz;
alter table contracts add column if not exists paid_by text;
alter table contracts add column if not exists accounting_notes text;

alter table contracts drop constraint if exists contracts_invoice_status_chk;
alter table contracts add constraint contracts_invoice_status_chk
  check (invoice_status in ('pending', 'invoice_sent', 'paid'));

create index if not exists contracts_status_invoice_status_idx on contracts (status, invoice_status);
create index if not exists contracts_invoice_status_idx on contracts (invoice_status);

alter table app_users add column if not exists is_accounting boolean not null default false;

alter table app_users add column if not exists can_impersonate boolean not null default false;
alter table app_users add column if not exists can_view_all_sales boolean not null default false;
alter table app_users add column if not exists theme_preference text
  check (theme_preference is null or theme_preference in ('light', 'dark', 'system'));
alter table app_users add column if not exists tour_completed_at timestamptz;
alter table app_users add column if not exists tour_last_role text;
alter table app_users add column if not exists last_login_at timestamptz;
alter table app_users add column if not exists last_dismissed_bubble_date date null;

alter table app_users add column if not exists sound_enabled boolean not null default false;

alter table audit_log add column if not exists impersonation_target_email text;

-- Daily dashboard bubble (see migration 028_daily_bubbles.sql for RLS + indexes).
create table if not exists daily_bubbles (
  id uuid primary key default gen_random_uuid(),
  content_date date not null unique,
  content_type text not null check (content_type in ('fact', 'joke', 'quote')),
  content text not null check (char_length(content) <= 250),
  attribution text null,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'ai',
  removed_at timestamptz null,
  removed_by text null,
  removed_reason text null,
  remove_token text null,
  remove_token_expires_at timestamptz null
);

-- Computed-ish helpers (views make more sense than generated columns for totals)
create or replace view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  coalesce(li.sub_cents, 0)::integer as line_items_subtotal_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as total_amount_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id
left join (
  select contract_id, sum(amount_cents)::bigint as sub_cents
  from contract_line_items
  group by contract_id
) li on li.contract_id = c.id;

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

alter table app_users add column if not exists is_events_team boolean not null default false;

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  approval_token text not null,
  token_expires_at timestamptz not null,
  granted_role text check (granted_role is null or granted_role in ('admin', 'sales', 'viewer', 'sales_rep')),
  granted_flags jsonb
);
create unique index if not exists access_requests_approval_token_key on access_requests(approval_token);

-- Seed admin accounts (idempotent)
insert into app_users (email, name, role) values
  ('mcapace@mshanken.com',   'Michael Capace', 'admin'),
  ('lmott@mshanken.com',     'Liz Mott',       'admin'),
  ('ssenatore@mshanken.com', 'Stephen Senatore','admin')
on conflict (email) do nothing;

update app_users
set is_events_team = true
where email in (
  'lmott@mshanken.com',
  'snolan@mshanken.com',
  'nmazza@mshanken.com',
  'talper@mshanken.com',
  'mcapace@mshanken.com',
  'jarcella@mshanken.com'
);

update app_users
set can_view_all_sales = true
where email = 'ssenatore@mshanken.com';

update app_users
set can_view_all_sales = true
where role = 'admin' or is_events_team = true or is_accounting = true;

insert into sales_reps (name, email, sort_order) values
  ('Stephen Senatore',   'ssenatore@mshanken.com',    10),
  ('Alyssa Weiss',       'aweiss@mshanken.com',       20),
  ('Michael DiChiara',   'mdichiara@mshanken.com',    30),
  ('Jake Cohen',         'jcohen@mshanken.com',       40),
  ('Miriam Morgenstern', 'mmorgenstern@mshanken.com', 50)
on conflict (email) do nothing;

-- -----------------------------------------------------------------------------
-- REP ASSISTANTS — assistants may manage contracts for assigned dept heads
-- -----------------------------------------------------------------------------

create table if not exists rep_assistants (
  id uuid primary key default gen_random_uuid(),
  assistant_email text not null,
  rep_id uuid not null references sales_reps(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assistant_email, rep_id)
);

create index if not exists rep_assistants_assistant_email_idx on rep_assistants(lower(assistant_email));
create index if not exists rep_assistants_rep_id_idx on rep_assistants(rep_id);

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

drop trigger if exists contract_line_items_set_updated_at on contract_line_items;
create trigger contract_line_items_set_updated_at
  before update on contract_line_items
  for each row execute function set_updated_at();

-- Status-change audit
create or replace function log_status_change() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into audit_log (contract_id, actor_email, action, from_status, to_status, metadata)
    values (new.id, current_setting('app.current_user_email', true), 'status_changed', old.status, new.status, null);
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_contracts_audit on contracts;
create trigger trg_contracts_audit
  after insert or update on contracts
  for each row execute function log_status_change();

-- -----------------------------------------------------------------------------
-- RLS helper — same audience as contract PDF reads (reps, assistants, events, admin, accounting executed)
-- -----------------------------------------------------------------------------
create or replace function user_can_read_contract_by_id(p_contract_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(trim(coalesce(auth.jwt()->>'email', '')));
  if v_email = '' then
    return false;
  end if;

  return exists (
    select 1
    from contracts c
    join app_users au on lower(au.email) = v_email and au.is_active = true
    where c.id = p_contract_id
      and (
        au.role = 'admin'
        or coalesce(au.is_events_team, false) = true
        or (
          coalesce(au.is_accounting, false) = true
          and c.status = 'executed'
        )
        or exists (
          select 1 from sales_reps sr
          where sr.id = c.sales_rep_id
            and lower(sr.email) = v_email
            and coalesce(sr.is_active, true) = true
        )
        or exists (
          select 1 from rep_assistants ra
          where ra.rep_id = c.sales_rep_id
            and lower(ra.assistant_email) = v_email
        )
      )
  );
end;
$$;

revoke all on function user_can_read_contract_by_id(uuid) from public;
grant execute on function user_can_read_contract_by_id(uuid) to authenticated;
grant execute on function user_can_read_contract_by_id(uuid) to service_role;

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
alter table access_requests enable row level security;
alter table rep_assistants enable row level security;
alter table contract_line_items enable row level security;

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

drop policy if exists deny_anon_rep_assistants on rep_assistants;
create policy deny_anon_rep_assistants on rep_assistants for all to anon using (false);

drop policy if exists deny_anon_contract_line_items on contract_line_items;
create policy deny_anon_contract_line_items on contract_line_items for all to anon using (false);

drop policy if exists contract_line_items_select on contract_line_items;
create policy contract_line_items_select
  on contract_line_items for select to authenticated
  using (user_can_read_contract_by_id(contract_id));

drop policy if exists contract_line_items_insert on contract_line_items;
create policy contract_line_items_insert
  on contract_line_items for insert to authenticated
  with check (
    user_can_read_contract_by_id(contract_id)
    and exists (select 1 from contracts c where c.id = contract_id and c.status = 'draft')
  );

drop policy if exists contract_line_items_update on contract_line_items;
create policy contract_line_items_update
  on contract_line_items for update to authenticated
  using (
    user_can_read_contract_by_id(contract_id)
    and exists (select 1 from contracts c where c.id = contract_id and c.status = 'draft')
  )
  with check (
    user_can_read_contract_by_id(contract_id)
    and exists (select 1 from contracts c where c.id = contract_id and c.status = 'draft')
  );

drop policy if exists contract_line_items_delete on contract_line_items;
create policy contract_line_items_delete
  on contract_line_items for delete to authenticated
  using (
    user_can_read_contract_by_id(contract_id)
    and exists (select 1 from contracts c where c.id = contract_id and c.status = 'draft')
  );

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
