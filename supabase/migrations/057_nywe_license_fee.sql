-- NYWE vendor licenses use a flat $14,000 fee (not WhiskyFest $15,000/booth structure).

update public.events
set booth_rate_cents = 1400000
where contract_template_profile = 'nywe_vendor'
   or product_key = 'wine_spectator';

update public.contracts c
set
  booth_count = 1,
  booth_rate_cents = e.booth_rate_cents
from public.events e
where c.event_id = e.id
  and e.contract_template_profile = 'nywe_vendor'
  and (c.booth_count <> 1 or c.booth_rate_cents <> e.booth_rate_cents);
