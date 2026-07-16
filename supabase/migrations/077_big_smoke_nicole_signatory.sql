-- BSLV countersigner is Nicole Mazza (same as WhiskyFest), not NYWE's Susannah Nolan.
-- Migration 072 seeded Susannah by mistake when copying NYWE event shape.

update public.events
set
  shanken_signatory_name = 'Nicole Mazza',
  shanken_signatory_title = 'Vice President, Events',
  shanken_signatory_email = 'nmazza@mshanken.com',
  updated_at = now()
where product_key = 'big_smoke'
  and trim(lower(coalesce(shanken_signatory_email, ''))) = 'snolan@mshanken.com';
