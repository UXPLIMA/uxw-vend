-- A category can be kept for the people who bought something.
--
-- The way a shop puts a members' shelf on a public site: everything in it is
-- for people who already hold the thing that unlocks it, and everybody else
-- should not see the shelf at all.
--
-- This is the one gate in the store that really hides. A product's
-- prerequisite is told to the shopper on purpose, because being told is how
-- they learn the tier below is worth buying; a category kept back is kept
-- back, and hiding a parent hides its children with it.
--
-- Additive. An empty list is visible to everybody, which is what every
-- existing category was.

ALTER TABLE "Category"
    ADD COLUMN IF NOT EXISTS "visibleAfterProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
