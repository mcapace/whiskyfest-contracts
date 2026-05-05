-- Pre-existing contracts entered manually (no DocuSign workflow).

alter type contract_status add value if not exists 'imported';

alter table public.contracts
  add column if not exists imported_at timestamptz,
  add column if not exists imported_by text,
  add column if not exists originally_signed_at timestamptz;

comment on column public.contracts.imported_at is 'When this legacy/off-system contract was entered into WhiskyFest Contracts.';
comment on column public.contracts.imported_by is 'App user email who performed the import.';
comment on column public.contracts.originally_signed_at is 'Date the sponsor originally signed (paper/prior DocuSign).';
