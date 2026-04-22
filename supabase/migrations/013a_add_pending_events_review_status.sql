-- Enum value must be committed before use (e.g. partial index predicates). Runs alone in its migration.

alter type contract_status add value if not exists 'pending_events_review';
