-- Add dedicated sales_rep app role (distinct from legacy `sales`).
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'user_role'
      and e.enumlabel = 'sales_rep'
  ) then
    alter type user_role add value 'sales_rep';
  end if;
end $$;
