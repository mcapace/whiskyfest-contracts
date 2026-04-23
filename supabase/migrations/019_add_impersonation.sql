-- Admin impersonation ("View as...") — flag + audit columns

alter table app_users add column if not exists can_impersonate boolean not null default false;

update app_users
set can_impersonate = true
where email in (
  'mcapace@mshanken.com',
  'jarcella@mshanken.com',
  'lmott@mshanken.com'
);

-- Who was impersonated (nullable for contract-only audit rows)
alter table audit_log add column if not exists impersonation_target_email text;

-- ---------------------------------------------------------------------------
-- app_users.can_impersonate + audit_log.impersonation_target_email are also
-- reflected in supabase/schema.sql for greenfield installs.
-- ---------------------------------------------------------------------------
