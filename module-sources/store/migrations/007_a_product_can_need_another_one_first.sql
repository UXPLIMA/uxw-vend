-- A product can need another one first.
--
-- Every upgrade path a shop sells has this shape: the tier above is only for
-- people already on the tier below, the add-on only makes sense with the thing
-- it adds to. Until now the rule could only be written in the product's own
-- description and enforced by refunding whoever did not read it.
--
-- Two shapes cover what shops ask for: own all of a list, or own at least one
-- of it. The second is how "any of our three memberships" is said.
--
-- Additive. An empty list asks for nothing, which is what every existing
-- product did.

ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "requiresProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "requiresAny" BOOLEAN NOT NULL DEFAULT false;
