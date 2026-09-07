-- A customer's keys are read newest first, a page at a time.
--
-- The query is `where userId, orderBy createdAt desc, take 51`. An index on
-- userId alone finds the rows and then leaves Postgres to sort every key the
-- account has ever been issued in order to hand back fifty. Measured on 300k
-- keys with one owner holding 2000: 55 shared buffers and 1.050ms, against
-- 5 buffers and 0.122ms once the composite index can be walked backward.
--
-- The composite answers both halves in one pass, and its leading column still
-- answers a plain userId lookup, so the old index has nothing left to do.
-- Dropping it is the only thing lost here: no data, and no query that the new
-- index does not serve at least as well.
--
-- Safe to run on a fresh install, where the new index already exists, and
-- safe to re-run.

CREATE INDEX IF NOT EXISTS "LicenseKey_userId_createdAt_idx"
    ON "LicenseKey" ("userId", "createdAt");

DROP INDEX IF EXISTS "LicenseKey_userId_idx";
