-- The comments under an article are read newest first.
--
-- The query is `where articleId and approved, orderBy createdAt desc`, and it
-- runs on every view of an article that allows comments. An index on
-- articleId alone finds the thread and then sorts all of it; a popular
-- article's thread is the case that grows.
--
-- The composite answers both halves, and its leading column still answers a
-- plain articleId lookup, so the old index has nothing left to do. Dropping
-- it loses no data and no query the new index does not serve.
--
-- Safe on a fresh install and safe to re-run.

CREATE INDEX IF NOT EXISTS "BlogComment_articleId_createdAt_idx"
    ON "BlogComment" ("articleId", "createdAt");

DROP INDEX IF EXISTS "BlogComment_articleId_idx";
