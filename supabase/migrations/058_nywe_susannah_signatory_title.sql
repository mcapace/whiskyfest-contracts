-- NYWE countersigner title for Susannah Nolan (License Agreement PDF + DocuSign).

update public.events
set shanken_signatory_title = 'Sr. Director of Events'
where product_key = 'wine_spectator'
  and trim(lower(coalesce(shanken_signatory_name, ''))) = 'susannah nolan';
