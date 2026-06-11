-- Wine Spectator portal admin for Susannah Nolan (NYWE events lead).

alter table public.app_users
  add column if not exists is_wine_spectator_admin boolean not null default false;

comment on column public.app_users.is_wine_spectator_admin is
  'Admin within the Wine Spectator / NYWE portal — events settings and contract admin actions without global app admin.';

insert into public.app_users (email, name, role, is_active, is_events_team, is_wine_spectator_admin, can_view_all_sales)
values (
  'snolan@mshanken.com',
  'Susannah Nolan',
  'viewer',
  true,
  true,
  true,
  true
)
on conflict (email) do update
set
  name = coalesce(public.app_users.name, excluded.name),
  is_active = true,
  is_events_team = true,
  is_wine_spectator_admin = true,
  can_view_all_sales = true;
