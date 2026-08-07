-- Big Smoke sponsorship-only: pin a same-portal template so resolution never
-- falls through WhiskyFest GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID.
-- Until a dedicated Big Smoke sponsorship Doc exists, reuse the Las Vegas booth template.
UPDATE public.events
SET google_sponsorship_template_doc_id = '17-kWFzFcaitKFvqbGxs7Q1X_I3lbEE7FdFhM0koc2H8'
WHERE id = '0f08df30-3ff2-4088-94f4-6232010bdcb0'
  AND (
    google_sponsorship_template_doc_id IS NULL
    OR trim(google_sponsorship_template_doc_id) = ''
  );
