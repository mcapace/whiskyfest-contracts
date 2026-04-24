-- Daily "Did You Know" / joke / quote bubble for the dashboard (one row per Eastern calendar day).

create table if not exists public.daily_bubbles (
  id uuid primary key default gen_random_uuid(),
  content_date date not null,
  content_type text not null check (content_type in ('fact', 'joke', 'quote')),
  content text not null check (char_length(content) <= 250),
  attribution text null,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'ai',
  removed_at timestamptz null,
  removed_by text null,
  removed_reason text null,
  remove_token text null,
  remove_token_expires_at timestamptz null,
  constraint daily_bubbles_content_date_key unique (content_date)
);

create index if not exists daily_bubbles_active_date_idx
  on public.daily_bubbles (content_date)
  where removed_at is null;

comment on table public.daily_bubbles is 'AI-generated daily whisky/spirits bubble; at most one active (non-removed) row per content_date.';

-- Per-user dismiss (hide banner for rest of day without removing for everyone).
alter table public.app_users
  add column if not exists last_dismissed_bubble_date date null;

comment on column public.app_users.last_dismissed_bubble_date is 'Eastern calendar date when user last dismissed the daily bubble; same-day bubble hidden for that user only.';

-- ---------------------------------------------------------------------------
-- RLS (Supabase Auth JWT). App server uses service role and bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.daily_bubbles enable row level security;

create or replace function public.is_app_admin_from_jwt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    where lower(au.email) = lower(nullif(trim(coalesce(auth.jwt()->>'email', '')), ''))
      and au.is_active = true
      and au.role = 'admin'
  );
$$;

revoke all on function public.is_app_admin_from_jwt() from public;
grant execute on function public.is_app_admin_from_jwt() to authenticated;
grant execute on function public.is_app_admin_from_jwt() to service_role;

create policy daily_bubbles_select_today_active
  on public.daily_bubbles
  for select
  to authenticated
  using (
    removed_at is null
    and content_date = ((now() at time zone 'America/New_York')::date)
  );

create policy daily_bubbles_admin_update
  on public.daily_bubbles
  for update
  to authenticated
  using (public.is_app_admin_from_jwt())
  with check (public.is_app_admin_from_jwt());

-- No inserts/updates/deletes for non-admins except select above; service role bypasses RLS for cron.
