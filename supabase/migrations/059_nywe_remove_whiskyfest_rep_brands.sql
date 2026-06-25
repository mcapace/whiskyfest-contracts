-- Wine Experience licenses are events-managed: no WhiskyFest sales rep or spirit booth brands.

update public.contracts c
set sales_rep_id = null
from public.events e
where c.event_id = e.id
  and e.product_key = 'wine_spectator';

delete from public.contract_booth_brands bb
using public.contracts c
join public.events e on e.id = c.event_id
where bb.contract_id = c.id
  and e.product_key = 'wine_spectator';

-- Drop whisky-style brand text on non-roster test imports (roster rows keep wine name + vintage).
update public.contracts c
set brands_poured = null
from public.events e
where c.event_id = e.id
  and e.product_key = 'wine_spectator'
  and c.source_sheet_id is null;
