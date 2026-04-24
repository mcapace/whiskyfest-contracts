-- Tutorial/onboarding completion tracking per user.

alter table app_users
  add column if not exists tour_completed_at timestamptz,
  add column if not exists tour_last_role text;
