-- A member's credit ledger is read newest first.
--
-- The query is `where userId, orderBy createdAt desc, take 20`. An index on
-- userId alone finds the rows and then leaves Postgres to sort every one of
-- them to hand back twenty, and a ledger only ever grows.
--
-- The composite answers both halves in one pass, and its leading column still
-- answers a plain userId lookup, so the old index has nothing left to do.
-- Dropping it is the only thing lost here: no data, and no query that the new
-- index does not serve at least as well.
--
-- Safe to run on a fresh install, where the new index already exists, and
-- safe to re-run.

CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx"
    ON "CreditTransaction" ("userId", "createdAt");

DROP INDEX IF EXISTS "CreditTransaction_userId_idx";
