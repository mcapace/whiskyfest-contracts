ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS can_view_all_sales BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE app_users
SET can_view_all_sales = TRUE
WHERE email = 'ssenatore@mshanken.com';

UPDATE app_users
SET can_view_all_sales = TRUE
WHERE role = 'admin' OR is_events_team = TRUE OR is_accounting = TRUE;
