-- A product gains the hours it is for sale in.
--
-- Until now the only switch was `isActive`, so everything a community
-- actually sells took a person watching a clock: a seasonal pack turned on by
-- hand on the 20th and off on the 5th, a Friday evening offer somebody had to
-- be awake for, and "one per account" enforced after the fact by reading the
-- orders and apologising.
--
-- Every hour here is read on the site's own clock, which an operator sets in
-- Settings > Site. Additive: every column is nullable or defaulted to the
-- behaviour the shop already had, so an existing product is unchanged.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availableFrom"        TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availableUntil"       TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availableDays"        INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availableFromMinute"  INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availableUntilMinute" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "outsideWindow"        TEXT NOT NULL DEFAULT 'countdown';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "perPersonLimit"       INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "perPersonPeriod"      TEXT NOT NULL DEFAULT 'ever';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "periodStock"          INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "periodStockWindow"    TEXT NOT NULL DEFAULT 'day';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "salePrice"            DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleFrom"             TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleUntil"            TIMESTAMP(3);

-- The public list asks "what is for sale right now" on every visit.
CREATE INDEX IF NOT EXISTS "Product_isActive_availableFrom_availableUntil_idx"
    ON "Product" ("isActive", "availableFrom", "availableUntil");

-- Counting what one person has bought, and what everyone has bought today,
-- both walk the paid order items for one product.
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");
