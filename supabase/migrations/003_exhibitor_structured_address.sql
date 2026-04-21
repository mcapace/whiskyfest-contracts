-- Structured exhibitor mailing address + optional legacy column sync
alter table contracts add column if not exists exhibitor_address_line1 text;
alter table contracts add column if not exists exhibitor_address_line2 text;
alter table contracts add column if not exists exhibitor_city text;
alter table contracts add column if not exists exhibitor_state text;
alter table contracts add column if not exists exhibitor_zip text;

-- Optional: copy old single-field addresses into line1 for display (best-effort; no parsing)
update contracts
set exhibitor_address_line1 = exhibitor_address
where exhibitor_address is not null
  and exhibitor_address <> ''
  and (exhibitor_address_line1 is null or exhibitor_address_line1 = '');
