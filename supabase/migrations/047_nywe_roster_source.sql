-- NYWE exhibitor roster: link contracts to Google Sheet rows + per-event sheet config.

alter table public.contracts
  add column if not exists source_sheet_id text,
  add column if not exists source_sheet_tab text,
  add column if not exists source_row_number integer;

comment on column public.contracts.source_sheet_id is
  'Google Spreadsheet id when contract was created from an exhibitor roster row.';
comment on column public.contracts.source_sheet_tab is
  'Sheet tab name within source_sheet_id (e.g. YES, Form Responses 1).';
comment on column public.contracts.source_row_number is
  '1-based row number in source_sheet_tab when the license was created.';

create unique index if not exists contracts_source_sheet_row_uidx
  on public.contracts (source_sheet_id, source_sheet_tab, source_row_number)
  where source_sheet_id is not null
    and source_sheet_tab is not null
    and source_row_number is not null;

alter table public.events
  add column if not exists exhibitor_roster_sheets jsonb;

comment on column public.events.exhibitor_roster_sheets is
  'Array of {key, label, spreadsheet_id, tab} for live exhibitor roster sync.';

update public.events
set exhibitor_roster_sheets = '[
  {"key":"returning","label":"Returning","spreadsheet_id":"1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk","tab":"YES"},
  {"key":"champagne","label":"Champagne & Sparkling","spreadsheet_id":"1kVKwZnSxa479OZ23u6SVe7Ztg6a51TglzeVaEbiDNxI","tab":"YES"},
  {"key":"new","label":"New Exhibitors","spreadsheet_id":"1IC_8cIQazLicQSw5GMcosUgttz56qqUrAVTHJCnYy6I","tab":"YES"}
]'::jsonb
where product_key = 'wine_spectator'
  and year = 2026
  and exhibitor_roster_sheets is null;
