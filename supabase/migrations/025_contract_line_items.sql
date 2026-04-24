-- Custom contract line items (sponsorships, activations, etc.) + totals on contracts_with_totals.

-- -----------------------------------------------------------------------------
-- Who may read a contract (matches user_can_read_contract_pdf contract gate)
-- -----------------------------------------------------------------------------
create or replace function public.user_can_read_contract_by_id(p_contract_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(trim(coalesce(auth.jwt()->>'email', '')));
  if v_email = '' then
    return false;
  end if;

  return exists (
    select 1
    from contracts c
    join app_users au on lower(au.email) = v_email and au.is_active = true
    where c.id = p_contract_id
      and (
        au.role = 'admin'
        or coalesce(au.is_events_team, false) = true
        or (
          coalesce(au.is_accounting, false) = true
          and c.status = 'executed'
        )
        or exists (
          select 1 from sales_reps sr
          where sr.id = c.sales_rep_id
            and lower(sr.email) = v_email
            and coalesce(sr.is_active, true) = true
        )
        or exists (
          select 1 from rep_assistants ra
          where ra.rep_id = c.sales_rep_id
            and lower(ra.assistant_email) = v_email
        )
      )
  );
end;
$$;

revoke all on function public.user_can_read_contract_by_id(uuid) from public;
grant execute on function public.user_can_read_contract_by_id(uuid) to authenticated;
grant execute on function public.user_can_read_contract_by_id(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- contract_line_items
-- -----------------------------------------------------------------------------
create table if not exists public.contract_line_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount_cents integer not null check (amount_cents >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_line_items_contract_id_idx
  on public.contract_line_items (contract_id);

drop trigger if exists contract_line_items_set_updated_at on public.contract_line_items;
create trigger contract_line_items_set_updated_at
  before update on public.contract_line_items
  for each row execute function set_updated_at();

alter table public.contract_line_items enable row level security;

drop policy if exists deny_anon_contract_line_items on public.contract_line_items;
create policy deny_anon_contract_line_items
  on public.contract_line_items for all to anon using (false);

drop policy if exists contract_line_items_select on public.contract_line_items;
create policy contract_line_items_select
  on public.contract_line_items for select to authenticated
  using (public.user_can_read_contract_by_id(contract_id));

drop policy if exists contract_line_items_insert on public.contract_line_items;
create policy contract_line_items_insert
  on public.contract_line_items for insert to authenticated
  with check (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  );

drop policy if exists contract_line_items_update on public.contract_line_items;
create policy contract_line_items_update
  on public.contract_line_items for update to authenticated
  using (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  )
  with check (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  );

drop policy if exists contract_line_items_delete on public.contract_line_items;
create policy contract_line_items_delete
  on public.contract_line_items for delete to authenticated
  using (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  );

-- -----------------------------------------------------------------------------
-- contracts_with_totals — booth + line items
-- -----------------------------------------------------------------------------
drop view if exists public.contracts_with_totals;

create view public.contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  coalesce(li.line_items_total_cents, 0)::integer as line_items_total_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.line_items_total_cents, 0))::integer as grand_total_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.line_items_total_cents, 0))::integer as total_amount_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from public.contracts c
left join public.sales_reps sr on sr.id = c.sales_rep_id
left join (
  select contract_id, sum(amount_cents)::bigint as line_items_total_cents
  from public.contract_line_items
  group by contract_id
) li on li.contract_id = c.id;
