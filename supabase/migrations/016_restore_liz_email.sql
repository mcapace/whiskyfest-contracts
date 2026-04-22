-- Restore Shanken signatory email where it was overridden for sandbox testing

update events
set shanken_signatory_email = 'lmott@mshanken.com'
where trim(lower(coalesce(shanken_signatory_email, ''))) = 'mcapace@mshanken.com';
