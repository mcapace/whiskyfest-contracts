-- Per-booth brand + expressions (multi-booth sponsors may pour different brands at each booth).

create table if not exists public.contract_booth_brands (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  booth_index integer not null check (booth_index > 0),
  brand_name text not null,
  expressions text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  unique (contract_id, booth_index)
);

create index if not exists idx_contract_booth_brands_contract_id
  on public.contract_booth_brands (contract_id);

alter table public.contract_booth_brands enable row level security;

drop policy if exists deny_anon_contract_booth_brands on public.contract_booth_brands;
create policy deny_anon_contract_booth_brands
  on public.contract_booth_brands for all to anon using (false);

drop policy if exists contract_booth_brands_select on public.contract_booth_brands;
create policy contract_booth_brands_select
  on public.contract_booth_brands for select to authenticated
  using (public.user_can_read_contract_by_id(contract_id));

drop policy if exists contract_booth_brands_insert on public.contract_booth_brands;
create policy contract_booth_brands_insert
  on public.contract_booth_brands for insert to authenticated
  with check (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  );

drop policy if exists contract_booth_brands_update on public.contract_booth_brands;
create policy contract_booth_brands_update
  on public.contract_booth_brands for update to authenticated
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

drop policy if exists contract_booth_brands_delete on public.contract_booth_brands;
create policy contract_booth_brands_delete
  on public.contract_booth_brands for delete to authenticated
  using (
    public.user_can_read_contract_by_id(contract_id)
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.status = 'draft'
    )
  );
