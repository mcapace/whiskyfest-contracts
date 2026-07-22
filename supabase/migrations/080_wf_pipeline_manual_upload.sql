-- Pending / new-business: mark that a signed PDF was received outside DocuSign.
alter table public.wf_pipeline_targets
  add column if not exists manual_upload_received boolean not null default false;

comment on column public.wf_pipeline_targets.manual_upload_received is
  'True when a manually signed contract PDF has been received for this pipeline row (even before import/link).';
