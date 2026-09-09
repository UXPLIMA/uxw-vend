-- A purchase can run out.
--
-- A product could only be owned outright, and the one way to sell access with
-- an end date was a Stripe subscription - which ties the shape of the offer to
-- whichever processor happens to be configured. A shop taking bank transfers
-- could not sell thirty days of anything.
--
-- The duration lives on the product and the end date lives on the ownership,
-- so the arithmetic is the same whoever took the money. A product also gains
-- the role a purchase grants, which is a different column from `roleIds`:
-- that one says who may buy, this one says what buying gives you.
--
-- Additive. Every existing product has no duration and grants no role, which
-- is exactly what it did before, and every existing ownership has no end date,
-- which is what "owned" meant until now.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "grantsRoleId" TEXT;

ALTER TABLE "OwnedProduct" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- The sweep asks for ownerships that have lapsed and nothing else, so the
-- index carries the column it filters on. Rows with no end date are the
-- majority and Postgres keeps them out of the way in the same index.
CREATE INDEX IF NOT EXISTS "OwnedProduct_expiresAt_idx" ON "OwnedProduct" ("expiresAt");
