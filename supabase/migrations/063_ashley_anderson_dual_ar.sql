-- Ashley Anderson — AR on WhiskyFest and NYWE accounting dashboards.
-- is_accounting unlocks invoice APIs; canAccessWineSpectator treats AR as NYWE-capable.

insert into public.app_users (email, name, role, is_accounting, is_active, can_view_all_sales)
values ('aanderson@mshanken.com', 'Ashley Anderson', 'viewer', true, true, true)
on conflict (email) do update set
  name = excluded.name,
  is_accounting = true,
  is_active = true,
  can_view_all_sales = true;
