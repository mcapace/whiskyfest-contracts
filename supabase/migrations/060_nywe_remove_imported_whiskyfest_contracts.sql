-- Remove legacy WhiskyFest PDF imports mistakenly stored on the NYWE event.

delete from public.contract_booth_brands bb
using public.contracts c
join public.events e on e.id = c.event_id
where bb.contract_id = c.id
  and e.product_key = 'wine_spectator'
  and c.source_sheet_id is null
  and (c.status = 'imported' or c.imported_at is not null);

delete from public.contracts c
using public.events e
where c.event_id = e.id
  and e.product_key = 'wine_spectator'
  and c.source_sheet_id is null
  and (c.status = 'imported' or c.imported_at is not null);
