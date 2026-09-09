-- Credits were sold by the unit, which sells nothing.
--
-- A buyer typed a number and paid that number times a price, so there was no
-- reason to buy a thousand rather than a hundred and no way for an operator to
-- say "buy this much and we round it up".
--
-- The bonus is a separate column on purpose. It is what the buyer receives and
-- never what they are charged: a gateway is asked for `price`, and the balance
-- goes up by `credits + bonusCredits`.
--
-- Additive. A shop that defines no package keeps selling credits by the unit.
CREATE TABLE IF NOT EXISTS "CreditPackage" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "credits"      INTEGER NOT NULL,
  "bonusCredits" INTEGER NOT NULL DEFAULT 0,
  "price"        DECIMAL(10,2) NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CreditPackage_isActive_order_idx" ON "CreditPackage"("isActive", "order");
