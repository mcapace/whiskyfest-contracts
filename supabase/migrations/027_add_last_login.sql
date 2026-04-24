-- Track when each app user last completed a successful OAuth sign-in.

alter table public.app_users
  add column if not exists last_login_at timestamptz null;

comment on column public.app_users.last_login_at is 'Set on each successful Google sign-in (NextAuth events.signIn).';
