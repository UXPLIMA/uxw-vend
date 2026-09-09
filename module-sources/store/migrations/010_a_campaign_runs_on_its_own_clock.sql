-- A campaign: one price change, many products, opening and closing itself.
--
-- Every rule a campaign needs already existed per product - a weekly window,
-- a sale price, an allowance that refills - and setting them ten times by hand
-- is how a shop ends up with nine products on offer and one that was missed,
-- and then with nine that never came off. This is the missing noun.
--
-- The hours are the site's own clock and wrap past midnight the same way a
-- product's do, because the code behind both is the same function.
--
-- Additive: a shop with no campaign behaves exactly as before.

CREATE TABLE IF NOT EXISTS "Campaign" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "days"        INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "fromMinute"  INTEGER,
    "untilMinute" INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Campaign_isActive_idx" ON "Campaign" ("isActive");

CREATE TABLE IF NOT EXISTS "CampaignEntry" (
    "id"         TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId"  TEXT NOT NULL,
    "price"      DECIMAL(10,2) NOT NULL,
    "stock"      INTEGER,
    CONSTRAINT "CampaignEntry_pkey" PRIMARY KEY ("id")
);
-- One entry per product per campaign: two would be two prices with nothing to
-- choose between them.
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignEntry_campaignId_productId_key"
    ON "CampaignEntry" ("campaignId", "productId");
CREATE INDEX IF NOT EXISTS "CampaignEntry_productId_idx" ON "CampaignEntry" ("productId");

DO $$
BEGIN
    ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "CampaignEntry" ADD CONSTRAINT "CampaignEntry_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
