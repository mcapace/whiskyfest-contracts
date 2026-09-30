-- Katherine Brumley: full admin on the WhiskyFest dashboard (amend, recall, revise-and-send,
-- resend-with-changes, void, cancel, discount approval, signer edits).
--
-- Before: role = sales_rep, can_view_all_sales, big_smoke_admin, assistant on every AE (078 / 086 / 088).
-- Every WhiskyFest contract action above checks role = 'admin' or is_events_team, and
-- resend-with-changes / cancel / approve-discount / reset-error check role = 'admin' only.
-- Same insert-or-update shape as 062 / 070 / 088 so it works whether or not the row exists.

insert into public.app_users (
  email,
  name,
  role,
  is_active,
  is_events_team,
  can_view_all_sales,
  is_big_smoke_admin
)
values (
  'kbrumley@mshanken.com',
  'Katherine Brumley',
  'admin',
  true,
  true,
  true,
  true
)
on conflict (email) do update
set
  name               = coalesce(public.app_users.name, excluded.name),
  role               = 'admin',
  is_active          = true,
  is_events_team     = true,
  can_view_all_sales = true,
  is_big_smoke_admin = true;
