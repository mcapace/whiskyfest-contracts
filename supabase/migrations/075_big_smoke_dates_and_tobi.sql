-- Big Smoke Las Vegas 2026 runs Fri Nov 6 – Sat Nov 7.
update public.events
set event_end_date = '2026-11-07'
where product_key = 'big_smoke'
  and event_date = '2026-11-06'
  and (event_end_date is null or event_end_date <> '2026-11-07');

-- Tobi Alper — Big Smoke portal admin (alongside NYWE / events team).
update public.app_users
set is_big_smoke_admin = true
where lower(email) = 'talper@mshanken.com';
