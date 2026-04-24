-- Add void metadata fields and ensure enum has voided terminal status.

do $$
begin
  alter type contract_status add value if not exists 'voided';
exception
  when duplicate_object then null;
end $$;

alter table contracts
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists voided_reason text;
