-- Contract PDFs in Supabase Storage (bucket contract-pdfs: private).
-- Paths: {contract_id}/draft.pdf | {contract_id}/signed.pdf

alter table contracts
  add column if not exists pdf_storage_path text;

drop view if exists contracts_with_totals;

create view contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  (c.booth_count * c.booth_rate_cents) as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from contracts c
left join sales_reps sr on sr.id = c.sales_rep_id;

-- Defence in depth when the browser uses a Supabase-authenticated session (JWT with email claim).
create or replace function public.user_can_read_contract_pdf(storage_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
  v_email text;
begin
  v_email := lower(trim(coalesce(auth.jwt()->>'email', '')));
  if v_email = '' then
    return false;
  end if;

  begin
    cid := split_part(storage_object_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from contracts c
    join app_users au on lower(au.email) = v_email and au.is_active = true
    where c.id = cid
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

revoke all on function public.user_can_read_contract_pdf(text) from public;
grant execute on function public.user_can_read_contract_pdf(text) to authenticated;
grant execute on function public.user_can_read_contract_pdf(text) to service_role;

drop policy if exists "contract_pdfs_authenticated_select" on storage.objects;

create policy "contract_pdfs_authenticated_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contract-pdfs'
    and public.user_can_read_contract_pdf(name)
  );
