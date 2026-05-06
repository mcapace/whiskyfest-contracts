-- Track last app activity (session use), not only OAuth sign-in.

alter table public.app_users
  add column if not exists last_seen_at timestamptz null;

comment on column public.app_users.last_seen_at is 'Updated on throttled interval while user has an active JWT session (see lib/auth jwt callback).';

update public.app_users
set last_seen_at = last_login_at
where last_seen_at is null
  and last_login_at is not null;
