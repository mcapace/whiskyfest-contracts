-- Opt-in UI sounds + haptics on successful actions (default off).
alter table app_users add column if not exists sound_enabled boolean not null default false;

comment on column app_users.sound_enabled is 'When true, client plays success feedback (sound + light haptic) after contract actions.';
