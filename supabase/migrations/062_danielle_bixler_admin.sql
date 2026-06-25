-- Danielle Bixler — global app admin (retains accounting access).

insert into public.app_users (email, name, role, is_accounting, is_active, can_view_all_sales)
values ('dbixler@mshanken.com', 'Danielle Bixler', 'admin', true, true, true)
on conflict (email) do update set
  name = coalesce(public.app_users.name, excluded.name),
  role = 'admin',
  is_accounting = true,
  is_active = true,
  can_view_all_sales = true;
