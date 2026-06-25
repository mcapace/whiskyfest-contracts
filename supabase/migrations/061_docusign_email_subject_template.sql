-- Per-event DocuSign signing email subject (supports {{winery_name}}, {{event_name}}, etc.).

alter table public.events
  add column if not exists docusign_email_subject_template text;

comment on column public.events.docusign_email_subject_template is
  'DocuSign email subject template. Tokens: {{winery_name}}, {{event_name}}, {{document_label}}, {{event_year}}. Max 100 chars after merge.';

update public.events
set docusign_email_subject_template = '{{winery_name}} — Please sign your {{event_name}} vendor license'
where product_key = 'wine_spectator'
  and contract_template_profile = 'nywe_vendor'
  and coalesce(trim(docusign_email_subject_template), '') = '';
