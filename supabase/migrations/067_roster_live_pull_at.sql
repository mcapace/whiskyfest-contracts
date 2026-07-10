-- Rate-limit live Google Sheets roster pulls (API quota: reads per minute per user).

alter table public.events
  add column if not exists roster_live_pull_at timestamptz;

comment on column public.events.roster_live_pull_at is
  'Last live Google Sheets roster read attempt — used to throttle manual/cron refreshes.';
