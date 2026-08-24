-- Katherine Brumley: Big Smoke portal admin + assistant for every active AE
-- (including Stephen Senatore). Mirrors 078/086 for WhiskyFest and 075 (Tobi)
-- for Big Smoke portal admin.

insert into public.app_users (email, name, role, is_active, can_view_all_sales, is_big_smoke_admin)
values (
  'kbrumley@mshanken.com',
  'Katherine Brumley',
  'sales_rep',
  true,
  true,
  true
)
on conflict (email) do update
set
  name = coalesce(public.app_users.name, excluded.name),
  is_active = true,
  can_view_all_sales = true,
  is_big_smoke_admin = true;

-- Delegate / assistant access for all active sales reps (Stephen included).
insert into public.rep_assistants (assistant_email, rep_id)
select 'kbrumley@mshanken.com', id
from public.sales_reps
where is_active = true
on conflict (assistant_email, rep_id) do nothing;

-- Explicit Stephen Senatore link (idempotent if already present via the insert above).
insert into public.rep_assistants (assistant_email, rep_id)
select 'kbrumley@mshanken.com', id
from public.sales_reps
where lower(email) = 'ssenatore@mshanken.com'
  and is_active = true
on conflict (assistant_email, rep_id) do nothing;
