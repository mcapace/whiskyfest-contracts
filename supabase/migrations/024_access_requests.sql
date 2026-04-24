create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  approval_token text not null,
  token_expires_at timestamptz not null,
  granted_role text check (granted_role is null or granted_role in ('admin', 'sales', 'viewer', 'sales_rep')),
  granted_flags jsonb
);

create unique index if not exists access_requests_approval_token_key on access_requests(approval_token);

alter table access_requests enable row level security;

create or replace function public.current_request_header(header_name text)
returns text
language plpgsql
stable
as $$
declare
  headers jsonb;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      return null;
  end;
  return lower(coalesce(headers ->> lower(header_name), headers ->> header_name, ''));
end;
$$;

drop policy if exists access_requests_admin_select on access_requests;
create policy access_requests_admin_select
on access_requests
for select
to authenticated
using (
  exists (
    select 1
    from app_users u
    where u.email = lower(auth.jwt()->>'email')
      and u.is_active = true
      and u.role = 'admin'
  )
);

drop policy if exists access_requests_admin_update on access_requests;
create policy access_requests_admin_update
on access_requests
for update
to authenticated
using (
  exists (
    select 1
    from app_users u
    where u.email = lower(auth.jwt()->>'email')
      and u.is_active = true
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from app_users u
    where u.email = lower(auth.jwt()->>'email')
      and u.is_active = true
      and u.role = 'admin'
  )
);

drop policy if exists access_requests_token_select on access_requests;
create policy access_requests_token_select
on access_requests
for select
to anon
using (
  status = 'pending'
  and token_expires_at > now()
  and approval_token = public.current_request_header('x-approval-token')
);
