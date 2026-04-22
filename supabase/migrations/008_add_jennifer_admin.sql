-- Add Jennifer Arcella as an active admin user.
-- Idempotent: safe to run multiple times.

insert into app_users (email, name, role, is_active)
values ('jarcella@mshanken.com', 'Jennifer Arcella', 'admin', true)
on conflict (email) do nothing;
