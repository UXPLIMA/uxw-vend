-- The credit ledger is this module's, and so is the index it is read by.
--
-- The table came from the shop, where it was created along with an index on
-- (userId, createdAt) - a member's history, newest first, twenty at a time.
-- Nothing about the table changes here: same name, same columns, same index.
-- What changed is which module declares it, and a module is expected to ship
-- the migration for an index it declares, so that an install which has the
-- table but not the index still gets one.
--
-- The shop's own `001_credit_ledger_index.sql` stays where it is: it is the
-- record of what happened on installs that ran it, and re-running this one
-- there does nothing.
--
-- Safe on a fresh install, where the schema already created both, and safe to
-- re-run.

CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx"
    ON "CreditTransaction" ("userId", "createdAt");
