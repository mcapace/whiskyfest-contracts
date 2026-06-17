-- Enable DocuSign client send for NYWE 2026 go-live.

update public.events
set client_send_enabled = true
where product_key = 'wine_spectator'
  and year = 2026;
