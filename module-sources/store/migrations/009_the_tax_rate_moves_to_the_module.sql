-- The tax rate moves to the store's own settings.
--
-- It lived as a bare `tax_rate` row in the site settings table, read at
-- checkout and written by a field on the payments screen. Two problems: the
-- rate is a shop's business and had no place among site-wide settings, and the
-- new "prices already include tax" switch has to sit beside it or an operator
-- can set one without the other.
--
-- Carried across rather than defaulted, because a silent change from "20 per
-- cent" to "no tax" is a shop undercharging every order until somebody reads
-- an invoice. An install that never set a rate is left alone.

-- `Setting.value` is jsonb, so the old rate may be stored as a JSON number or
-- as a JSON string depending on which screen wrote it. `#>> '{}'` reads the
-- text of either, and the pattern check keeps anything else out of a numeric
-- cast that would abort the whole migration.
UPDATE "ModuleConfig"
SET "config" = jsonb_set(
        COALESCE("config", '{}')::jsonb,
        '{taxRate}',
        to_jsonb((("Setting"."value" #>> '{}'))::numeric)
    )
FROM "Setting"
WHERE "ModuleConfig"."id" = 'store'
  AND "Setting"."key" = 'tax_rate'
  AND ("Setting"."value" #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$'
  AND (("Setting"."value" #>> '{}'))::numeric > 0;

-- The old row goes once its value is safe: leaving it means two places
-- claiming to hold the rate, and the one nothing reads eventually disagrees.
DELETE FROM "Setting" WHERE "key" = 'tax_rate';
