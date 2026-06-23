-- Optional DocuSign carbon copy on exhibitor signing emails (e.g. signer's assistant).

alter table public.contracts
  add column if not exists signer_cc_name text,
  add column if not exists signer_cc_email text;

comment on column public.contracts.signer_cc_name is
  'Optional name for DocuSign carbon copy when the contract is sent for exhibitor signature.';
comment on column public.contracts.signer_cc_email is
  'Optional email CC''d on DocuSign signing notifications (does not sign).';
