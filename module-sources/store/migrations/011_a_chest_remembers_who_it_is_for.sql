-- A claimed purchase delivered to the wrong person.
--
-- Checkout asks for the name to deliver to separately from the name the buyer
-- signed in with. A purchase that waited in the chest kept neither that name
-- nor the fields the product asked for, so claiming it ran the commands with
-- the account's username and no answers at all.
--
-- Both columns are nullable and nothing is backfilled: the answers were never
-- written for rows already in a chest, and inventing one would deliver to a
-- name nobody chose. Those rows ask at claim time instead.
ALTER TABLE "ChestItem" ADD COLUMN IF NOT EXISTS "playerName" TEXT;
ALTER TABLE "ChestItem" ADD COLUMN IF NOT EXISTS "variables" JSONB;
