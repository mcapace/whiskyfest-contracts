-- Sponsor-facing notes entered in the dashboard and merged into the contract PDF ({{exhibitor_notes}}).

alter table public.contracts
  add column if not exists exhibitor_notes text;

comment on column public.contracts.exhibitor_notes is
  'Misc terms visible to the exhibitor on the signed contract PDF; entered by sales/events in the app.';
