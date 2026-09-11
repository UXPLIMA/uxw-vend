-- A release entry can carry more than the line it shows on the timeline.
--
-- The timeline is a list, and a list is the wrong place for a screenshot or
-- for the three paragraphs explaining why a change was made the way it was.
-- An operator who wants to say more now has somewhere to say it, and the entry
-- gets a page of its own.
--
-- `number` is what the URL is built from. A slug taken from the title would
-- break every shared link the first time somebody fixed a typo in it, so the
-- number is the stable half and the slug is cosmetic - the same shape an
-- article already uses. SERIAL backfills existing rows in insertion order,
-- which is the order they were written and the order the timeline shows them.
--
-- `details` and `coverImage` are nullable because most releases will never
-- have either, and an entry without them keeps behaving exactly as it did:
-- no page, no link to follow.
--
-- Safe on a fresh install and safe to re-run.

ALTER TABLE "ChangelogEntry" ADD COLUMN IF NOT EXISTS "number" SERIAL;
ALTER TABLE "ChangelogEntry" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChangelogEntry" ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE "ChangelogEntry" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ChangelogEntry_number_key"
    ON "ChangelogEntry" ("number");

CREATE INDEX IF NOT EXISTS "ChangelogEntry_slug_idx"
    ON "ChangelogEntry" ("slug");

-- Rows written before this have no slug. The page resolves by number and
-- treats the slug as decoration, so an empty one still works - but filling it
-- in makes the existing links readable too.
UPDATE "ChangelogEntry"
   SET "slug" = regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')
 WHERE "slug" = '';
