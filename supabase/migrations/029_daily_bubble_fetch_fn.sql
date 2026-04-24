-- Fetch today's active bubble using Postgres Eastern date (matches RLS policy and cron inserts).

create or replace function public.get_active_daily_bubble_eastern_today()
returns setof public.daily_bubbles
language sql
stable
security definer
set search_path = public
as $$
  select db.*
  from public.daily_bubbles db
  where db.removed_at is null
    and db.content_date = ((now() at time zone 'America/New_York')::date)
  limit 1;
$$;

revoke all on function public.get_active_daily_bubble_eastern_today() from public;
grant execute on function public.get_active_daily_bubble_eastern_today() to service_role;

comment on function public.get_active_daily_bubble_eastern_today() is 'Service-role: one active daily_bubbles row for current Eastern calendar day.';
