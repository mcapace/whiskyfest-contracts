-- Client revision rounds: custom terms + optional uploaded redlined PDF.

alter table public.contracts
  add column if not exists revision_amendments text,
  add column if not exists revision_upload_path text,
  add column if not exists revision_use_uploaded_pdf boolean not null default false,
  add column if not exists revision_round integer not null default 0;

comment on column public.contracts.revision_amendments is
  'Client-specific terms/amendments merged into {{revision_amendments}} on the contract PDF.';
comment on column public.contracts.revision_upload_path is
  'Supabase storage path for an uploaded redlined PDF (contract-pdfs bucket).';
comment on column public.contracts.revision_use_uploaded_pdf is
  'When true, the uploaded revision PDF is sent via DocuSign instead of regenerating from the master template.';
comment on column public.contracts.revision_round is
  'Count of revise-and-send rounds after client redlines.';
