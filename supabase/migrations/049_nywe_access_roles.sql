-- Ensure Susannah Nolan and NYWE events-team access for Wine Spectator portal.

update public.app_users
set is_events_team = true
where email in (
  'snolan@mshanken.com'
)
  and is_active = true;
