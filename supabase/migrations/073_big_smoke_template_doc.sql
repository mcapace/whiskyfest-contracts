-- Attach Big Smoke master Google Doc template to the Las Vegas 2026 event
-- (and any other big_smoke events still missing a template id).

update public.events
set google_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
where product_key = 'big_smoke'
  and (
    google_template_doc_id is null
    or trim(google_template_doc_id) = ''
    or (
      year = 2026
      and name ilike '%Las Vegas%'
    )
  );
