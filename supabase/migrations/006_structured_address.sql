-- Structured exhibitor address (v2 naming with underscores)
-- 1) Move legacy single-line address into exhibitor_address_line_1
-- 2) Ensure structured columns exist
-- 3) Best-effort parse from line_1 into city/state/zip where possible

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracts'
      and column_name = 'exhibitor_address'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contracts'
        and column_name = 'exhibitor_address_line_1'
    ) then
      alter table contracts rename column exhibitor_address to exhibitor_address_line_1;
    else
      execute $q$
        update contracts
        set exhibitor_address_line_1 = coalesce(nullif(trim(exhibitor_address_line_1), ''), exhibitor_address)
        where exhibitor_address is not null and trim(exhibitor_address) <> ''
      $q$;
      alter table contracts drop column exhibitor_address;
    end if;
  end if;
end $$;

alter table contracts add column if not exists exhibitor_address_line_1 text;
alter table contracts add column if not exists exhibitor_address_line_2 text;
alter table contracts add column if not exists exhibitor_city text;
alter table contracts add column if not exists exhibitor_state text;
alter table contracts add column if not exists exhibitor_zip text;

-- Backfill from older non-underscored structured columns (if present)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'exhibitor_address_line1'
  ) then
    execute $q$
      update contracts
      set exhibitor_address_line_1 = coalesce(nullif(trim(exhibitor_address_line_1), ''), exhibitor_address_line1)
      where exhibitor_address_line1 is not null and trim(exhibitor_address_line1) <> ''
    $q$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'exhibitor_address_line2'
  ) then
    execute $q$
      update contracts
      set exhibitor_address_line_2 = coalesce(nullif(trim(exhibitor_address_line_2), ''), exhibitor_address_line2)
      where exhibitor_address_line2 is not null and trim(exhibitor_address_line2) <> ''
    $q$;
  end if;
end $$;

-- Best-effort parser:
-- "825 8th Avenue, New York, NY 10019"
-- -> line_1, city, state, zip
with parsed as (
  select
    id,
    regexp_match(
      exhibitor_address_line_1,
      '^(.+?),\s*([^,]+),\s*([A-Za-z]{2,})\s+([A-Za-z0-9\- ]+)$'
    ) as m
  from contracts
  where exhibitor_address_line_1 is not null
    and trim(exhibitor_address_line_1) <> ''
    and (exhibitor_city is null or trim(exhibitor_city) = '')
    and (exhibitor_state is null or trim(exhibitor_state) = '')
    and (exhibitor_zip is null or trim(exhibitor_zip) = '')
)
update contracts c
set
  exhibitor_address_line_1 = nullif(trim(parsed.m[1]), ''),
  exhibitor_city = nullif(trim(parsed.m[2]), ''),
  exhibitor_state = nullif(trim(parsed.m[3]), ''),
  exhibitor_zip = nullif(trim(parsed.m[4]), '')
from parsed
where c.id = parsed.id
  and parsed.m is not null;
