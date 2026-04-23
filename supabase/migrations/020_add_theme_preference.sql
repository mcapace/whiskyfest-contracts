-- Theme preference for dashboard UI (nullable = follow OS / first-visit system)
alter table app_users
  add column if not exists theme_preference text
  check (theme_preference is null or theme_preference in ('light', 'dark', 'system'));
