-- Contract creation is audited from the API (`contract_created` with metadata).
-- Keep status-change audit on UPDATE only.
create or replace function log_status_change() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into audit_log (contract_id, actor_email, action, from_status, to_status, metadata)
    values (new.id, current_setting('app.current_user_email', true), 'status_changed', old.status, new.status, null);
  end if;
  return new;
end $$ language plpgsql;
