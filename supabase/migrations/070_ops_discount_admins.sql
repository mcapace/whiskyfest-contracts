-- Shared ops/admin permissions for discount approval + events + NYWE portal admin:
-- Nicole Mazza, Stephen Senatore, Tobi Alper, Michael Capace, Jennifer Arcella.

insert into public.app_users (email, name, role, is_active, is_events_team, is_wine_spectator_admin, can_view_all_sales)
values
  ('nmazza@mshanken.com', 'Nicole Mazza', 'admin', true, true, true, true),
  ('ssenatore@mshanken.com', 'Stephen Senatore', 'admin', true, true, true, true),
  ('talper@mshanken.com', 'Tobi Alper', 'admin', true, true, true, true),
  ('mcapace@mshanken.com', 'Michael Capace', 'admin', true, true, true, true),
  ('jarcella@mshanken.com', 'Jennifer Arcella', 'admin', true, true, true, true)
on conflict (email) do update
set
  name = coalesce(excluded.name, public.app_users.name),
  role = 'admin',
  is_active = true,
  is_events_team = true,
  is_wine_spectator_admin = true,
  can_view_all_sales = true;
