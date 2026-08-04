-- Nicole Mazza title on WhiskyFest contracts: Event Director (not Senior Event Director).

update public.events
set shanken_signatory_title = 'Event Director'
where product_key = 'whiskyfest'
  and lower(trim(shanken_signatory_email)) = 'nmazza@mshanken.com';

comment on column public.events.shanken_signatory_title is
  'Printed under the Shanken countersignature on the contract PDF ({{shanken_signatory_title}}).';
