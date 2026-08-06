-- Fix Big Smoke template resolution: only Las Vegas should use the Las Vegas template.
-- Revert the blanket application from migration 073 for non-Las Vegas Big Smoke events.
-- This ensures events like Agua Caliente won't incorrectly inherit the Las Vegas template.

-- Clear the template doc ID for Big Smoke events that aren't Las Vegas 2026
-- (so they don't inherit the wrong template by default).
update public.events
set google_template_doc_id = null
where product_key = 'big_smoke'
  and google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  and not (year = 2026 and name ilike '%Las Vegas%');

-- Ensure Las Vegas 2026 specifically has the correct template
update public.events
set google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
where product_key = 'big_smoke'
  and year = 2026
  and name ilike '%Las Vegas%'
  and (
    google_template_doc_id is null
    or trim(google_template_doc_id) = ''
    or google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
  );
