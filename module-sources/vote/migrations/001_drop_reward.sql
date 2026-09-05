-- Vote sites no longer pay a reward.
--
-- The module was "vote for rewards": each site carried a credit amount and
-- the claim handler moved that amount into the voter's balance. It is a
-- directory of places to vote now, so the column has nothing left to say and
-- the module no longer depends on credits at all.
--
-- Safe to run on a fresh install, where the column was never created, and
-- safe to re-run.

ALTER TABLE "VoteSite" DROP COLUMN IF EXISTS "reward";
