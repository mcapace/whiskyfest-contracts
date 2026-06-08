-- Sponsor-only deals: no booth row on the contract order (booth_count = 0).

alter table public.contracts
  add column if not exists order_type text not null default 'booth';

update public.contracts
set order_type = 'booth'
where order_type is null or order_type = '';

alter table public.contracts
  drop constraint if exists contracts_booth_count_check;

alter table public.contracts
  add constraint contracts_order_type_check
  check (order_type in ('booth', 'sponsorship_only'));

alter table public.contracts
  add constraint contracts_booth_order_check
  check (
    (order_type = 'booth' and booth_count > 0)
    or (order_type = 'sponsorship_only' and booth_count = 0 and booth_rate_cents = 0)
  );

comment on column public.contracts.order_type is
  'booth = standard booth package; sponsorship_only = line-item charges only (no booth).';
