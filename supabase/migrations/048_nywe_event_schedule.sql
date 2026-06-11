-- NYWE 2026 schedule: Oct 22–24, 2026 · 6:00 PM · Marriott Marquis

alter table public.events
  add column if not exists event_end_date date,
  add column if not exists event_start_time text;

comment on column public.events.event_end_date is
  'Last day of a multi-day event (optional; event_date is the first day).';
comment on column public.events.event_start_time is
  'Human-readable daily start time for display, e.g. 6:00 PM.';

update public.events
set
  event_date = '2026-10-22'::date,
  event_end_date = '2026-10-24'::date,
  event_start_time = '6:00 PM',
  venue = 'Marriott Marquis, 1535 Broadway, New York, NY 10036',
  location = 'New York, NY'
where product_key = 'wine_spectator'
  and year = 2026;
