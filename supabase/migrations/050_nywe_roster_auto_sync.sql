-- Cache automated NYWE exhibitor roster pulls from Google Sheets (master lists).

alter table public.events
  add column if not exists roster_last_synced_at timestamptz,
  add column if not exists roster_cached_snapshot jsonb;

comment on column public.events.roster_last_synced_at is
  'When the exhibitor roster was last refreshed from Google Sheets (cron or manual).';
comment on column public.events.roster_cached_snapshot is
  'Cached exhibitor roster payload: { syncedAt, sheets, rows }.';
