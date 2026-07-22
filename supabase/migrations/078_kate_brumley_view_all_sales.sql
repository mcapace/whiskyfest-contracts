-- Katherine Brumley: full WhiskyFest sales visibility (was scoped to Stephen + Jody only via rep_assistants).
UPDATE public.app_users
SET
  is_active = true,
  can_view_all_sales = true
WHERE email = 'kbrumley@mshanken.com';
