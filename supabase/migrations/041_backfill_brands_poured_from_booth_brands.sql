-- Sync legacy brands_poured text from per-booth brand names (e.g. imported contracts).

update public.contracts c
set brands_poured = sub.names
from (
  select
    contract_id,
    string_agg(trim(brand_name), ', ' order by booth_index) as names
  from public.contract_booth_brands
  where trim(brand_name) <> ''
  group by contract_id
) sub
where c.id = sub.contract_id
  and (c.brands_poured is null or trim(c.brands_poured) = '');
