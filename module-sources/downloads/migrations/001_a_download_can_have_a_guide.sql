-- A download can carry the instructions that make it useful.
--
-- A launcher, a mod pack or a config bundle is rarely self-explanatory: there
-- are steps, a version of something else it needs, a screenshot of the screen
-- where the setting lives. The list has room for one line, which is the right
-- amount for most files and none at all for those.
--
-- `number` is what the URL is built from, for the same reason the changelog
-- uses one: a slug taken from the title breaks every shared link the first
-- time somebody renames the file. SERIAL backfills existing rows in insertion
-- order.
--
-- `details` and `coverImage` are nullable because most downloads will never
-- have either, and a row without them keeps its old behaviour - no page, and
-- no link away from the button.
--
-- Safe on a fresh install and safe to re-run.

ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "number" SERIAL;
ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Download_number_key" ON "Download" ("number");
CREATE INDEX IF NOT EXISTS "Download_slug_idx" ON "Download" ("slug");

UPDATE "Download"
   SET "slug" = regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')
 WHERE "slug" = '';
