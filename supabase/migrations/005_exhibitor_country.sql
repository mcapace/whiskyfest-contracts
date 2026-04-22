-- Add country support for international exhibitor addresses.
alter table contracts add column if not exists exhibitor_country text;

-- Best-effort backfill: if structured US state/ZIP exists and country is blank, default to United States.
update contracts
set exhibitor_country = 'United States'
where (exhibitor_country is null or trim(exhibitor_country) = '')
  and (
    (exhibitor_state is not null and trim(exhibitor_state) <> '')
    or (exhibitor_zip is not null and trim(exhibitor_zip) <> '')
  );
