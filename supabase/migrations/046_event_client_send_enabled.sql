  -- Gate DocuSign send per event (NYWE internal prep: no client sends until enabled).

  alter table public.events
    add column if not exists client_send_enabled boolean not null default true;

  comment on column public.events.client_send_enabled is
    'When false, approved contracts cannot be sent via DocuSign (internal prep / staging).';

  update public.events
  set client_send_enabled = false
  where product_key = 'wine_spectator';
