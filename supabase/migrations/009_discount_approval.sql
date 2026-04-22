alter table contracts
  add column if not exists discount_approved_at timestamptz,
  add column if not exists discount_approved_by text,
  add column if not exists discount_approval_reason text;

create index if not exists contracts_discount_pending_idx
  on contracts (id)
  where booth_rate_cents < 1500000 and discount_approved_at is null;
