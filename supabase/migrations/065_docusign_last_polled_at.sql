-- Throttle DocuSign polling so dashboard/cron do not re-check the same envelopes every page load.
alter table public.contracts
  add column if not exists docusign_last_polled_at timestamptz;

comment on column public.contracts.docusign_last_polled_at is
  'Last time the app polled DocuSign for this envelope (status/recipients). Used to avoid hourly API limit exhaustion.';

create index if not exists contracts_docusign_poll_idx
  on public.contracts (docusign_last_polled_at nulls first, sent_at desc nulls last)
  where docusign_envelope_id is not null
    and status in ('sent', 'partially_signed', 'error', 'signed');
