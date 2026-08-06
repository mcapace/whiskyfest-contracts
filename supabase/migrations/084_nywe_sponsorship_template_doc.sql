-- NYWE sponsorship-only Google Doc template (native Google Doc; Word upload was converted).
-- Source Word file: 1zjWwqp_0HlHuSw4-WKH2iC8Jr7pv-0f-
-- Native Doc (CONTRACT ORDER + GRAND TOTAL): 1KgIxbTZuJafrLjarhIfUq9WVBphOcZKfDNLtlfRWu7k
-- Prefer contract_template_profile / name (works even if product_key is missing on older DBs).
UPDATE events
SET google_sponsorship_template_doc_id = '1KgIxbTZuJafrLjarhIfUq9WVBphOcZKfDNLtlfRWu7k'
WHERE is_active = true
  AND (
    contract_template_profile = 'nywe_vendor'
    OR name ILIKE '%Wine Experience%'
  );
