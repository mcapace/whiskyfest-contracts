-- Backfill product_key on contract_viewed audit rows so NYWE views show the correct portal label.

update public.audit_log al
set metadata = coalesce(al.metadata, '{}'::jsonb) || jsonb_build_object('product_key', e.product_key)
from public.contracts c
join public.events e on e.id = c.event_id
where al.contract_id = c.id
  and al.action = 'contract_viewed'
  and coalesce(al.metadata->>'product_key', '') = '';
