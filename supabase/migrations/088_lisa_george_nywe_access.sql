-- Lisa George access for NYWE: QR Codes and creative assets only.

alter table public.app_users
  add column if not exists is_qr_only boolean not null default false;

comment on column public.app_users.is_qr_only is
  'Restricted user with access limited exclusively to NYWE executed booth QR codes and asset downloads.';

insert into public.app_users (
  email,
  name,
  role,
  is_active,
  is_events_team,
  is_wine_spectator_admin,
  can_view_all_sales,
  is_qr_only
)
values (
  'lgeorge@mshanken.com',
  'Lisa George',
  'viewer',
  true,
  false,
  false,
  false,
  true
)
on conflict (email) do update
set
  name = coalesce(public.app_users.name, excluded.name),
  is_active = true,
  is_events_team = false,
  is_wine_spectator_admin = false,
  can_view_all_sales = false,
  is_qr_only = true;
