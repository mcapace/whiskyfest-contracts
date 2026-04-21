-- Phase 2: partially_signed status + cancel columns (idempotent)
-- Run in Supabase SQL Editor if migrations are not auto-applied.

do $$ begin
  alter type contract_status add value 'partially_signed';
exception
  when duplicate_object then null;
end $$;

alter table contracts add column if not exists cancelled_reason text;
alter table contracts add column if not exists cancelled_at timestamptz;
alter table contracts add column if not exists cancelled_by text;
