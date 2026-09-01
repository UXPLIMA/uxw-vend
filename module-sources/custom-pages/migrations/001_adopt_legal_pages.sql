-- Adopt the legal pages core used to serve at /legal/<slug>.
--
-- Core once shipped a hardcoded four-slug route backed by `legal_*` rows in
-- Setting. That route is gone; this module owns admin-edited public pages, so
-- it claims the existing content on install instead of orphaning it.
--
-- Safe to run on a fresh install: the SELECT simply matches no rows.
-- Safe to re-run: `slug` is unique and conflicts are skipped, so a page the
-- admin already authored under the same slug is never overwritten.

INSERT INTO "CustomPage" (id, title, slug, content, "isActive", "order", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    legal.title,
    legal.slug,
    s.value #>> '{}',
    true,
    legal.ord,
    NOW(),
    NOW()
FROM (
    VALUES
        ('legal_terms',   'terms',   'Terms of Service', 1),
        ('legal_privacy', 'privacy', 'Privacy Policy',   2),
        ('legal_refund',  'refund',  'Refund Policy',    3),
        ('legal_rules',   'rules',   'Server Rules',     4)
) AS legal(setting_key, slug, title, ord)
JOIN "Setting" s ON s.key = legal.setting_key
-- `#>> '{}'` unwraps a JSON scalar to text; anything that is not a non-empty
-- JSON string (null, an object, an empty draft) has nothing worth adopting.
WHERE jsonb_typeof(s.value::jsonb) = 'string'
  AND length(btrim(s.value #>> '{}')) > 0
ON CONFLICT (slug) DO NOTHING;
