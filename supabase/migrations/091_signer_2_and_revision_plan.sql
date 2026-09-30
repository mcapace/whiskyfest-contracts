-- Optional second client signer (parallel DocuSign recipient at routing order 1) and a persisted,
-- structured revision plan so inline contract edits survive every re-render (send, resend, preview).

alter table public.contracts
  add column if not exists signer_2_name text,
  add column if not exists signer_2_title text,
  add column if not exists signer_2_email text,
  add column if not exists revision_plan jsonb;

comment on column public.contracts.signer_2_name is
  'Optional second exhibitor signatory (DocuSign recipient 4, routing order 1, anchors \s3\ / \d3\).';
comment on column public.contracts.signer_2_title is
  'Job title printed under the second signatory signature line.';
comment on column public.contracts.signer_2_email is
  'Email the second signatory signs from (remote DocuSign signing).';
comment on column public.contracts.revision_plan is
  'Structured inline edits (paragraph replace / delete / insert, text replacements, additional terms) applied to the Google Doc on every render.';

-- contracts_with_totals freezes c.* at creation time; recreate so the new columns flow through.
drop view if exists public.contracts_with_totals;

create view public.contracts_with_totals as
select
  c.*,
  (c.booth_count * c.booth_rate_cents) as booth_subtotal_cents,
  0::int as additional_brand_fee_cents,
  coalesce(li.sub_cents, 0)::integer as line_items_subtotal_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as total_amount_cents,
  ((c.booth_count * c.booth_rate_cents) + coalesce(li.sub_cents, 0))::integer as grand_total_cents,
  sr.name as sales_rep_name,
  sr.email as sales_rep_email
from public.contracts c
left join public.sales_reps sr on sr.id = c.sales_rep_id
left join (
  select contract_id, sum(amount_cents)::bigint as sub_cents
  from public.contract_line_items
  group by contract_id
) li on li.contract_id = c.id;
