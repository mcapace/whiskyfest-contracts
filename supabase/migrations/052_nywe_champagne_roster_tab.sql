-- Fix NYWE champagne roster tab: spreadsheet uses "YES", not "Form Responses 1".

update public.events
set exhibitor_roster_sheets = '[
  {"key":"returning","label":"Returning","spreadsheet_id":"1tQ2M7a1KM3qh1nRJDZy4IvMx4gX5ITr_1T0gvjwAPHk","tab":"YES"},
  {"key":"champagne","label":"Champagne & Sparkling","spreadsheet_id":"1kVKwZnSxa479OZ23u6SVe7Ztg6a51TglzeVaEbiDNxI","tab":"YES"},
  {"key":"new","label":"New Exhibitors","spreadsheet_id":"1IC_8cIQazLicQSw5GMcosUgttz56qqUrAVTHJCnYy6I","tab":"YES"}
]'::jsonb
where product_key = 'wine_spectator'
  and year = 2026;
