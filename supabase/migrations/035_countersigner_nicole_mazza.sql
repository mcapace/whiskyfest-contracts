-- Default M. Shanken countersigner on events: Nicole Mazza (new envelopes route here).
-- Does not alter in-flight DocuSign envelopes.

update public.events
set
  shanken_signatory_name = 'Nicole Mazza',
  shanken_signatory_email = 'nmazza@mshanken.com'
where true;

comment on column public.events.shanken_signatory_email is 'DocuSign routing 2 (countersigner). Updated May 2026 to Nicole Mazza.';
