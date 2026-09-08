-- One wheel became many.
--
-- There was a single wheel: free, once a day, for everybody, with the price
-- of an extra turn in a module setting. That is a reasonable shape for one
-- community and no shape at all for the rest - a free daily wheel and a
-- weekly one for people who bought a rank are two wheels, not two settings on
-- one. So the cooldown, the price and who may turn it move onto the wheel.
--
-- Additive, and the existing prizes and spins are carried onto a wheel that
-- keeps the old behaviour rather than being left pointing at nothing.

CREATE TABLE IF NOT EXISTS "Wheel" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "description"   TEXT,
    "cooldown"      TEXT NOT NULL DEFAULT 'daily',
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "cost"          INTEGER NOT NULL DEFAULT 0,
    "roleIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "order"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wheel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wheel_slug_key" ON "Wheel" ("slug");
CREATE INDEX IF NOT EXISTS "Wheel_isActive_order_idx" ON "Wheel" ("isActive", "order");

ALTER TABLE "WheelPrize" ADD COLUMN IF NOT EXISTS "wheelId" TEXT;
ALTER TABLE "WheelSpin"  ADD COLUMN IF NOT EXISTS "wheelId" TEXT;

CREATE INDEX IF NOT EXISTS "WheelPrize_wheelId_idx" ON "WheelPrize" ("wheelId");
CREATE INDEX IF NOT EXISTS "WheelSpin_userId_wheelId_createdAt_idx"
    ON "WheelSpin" ("userId", "wheelId", "createdAt");
-- The foreign key's own index: retiring a wheel has to find its turns without
-- reading the table.
CREATE INDEX IF NOT EXISTS "WheelSpin_wheelId_idx" ON "WheelSpin" ("wheelId");

-- The wheel this install already had, with the behaviour it already had.
INSERT INTO "Wheel" ("id", "name", "slug", "description", "cooldown", "cooldownHours", "cost", "isActive", "order", "updatedAt")
SELECT 'wheel-default', 'Wheel of Fortune', 'wheel', NULL, 'daily', 24, 0, true, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Wheel");

UPDATE "WheelPrize" SET "wheelId" = (SELECT "id" FROM "Wheel" ORDER BY "order" LIMIT 1) WHERE "wheelId" IS NULL;
UPDATE "WheelSpin"  SET "wheelId" = (SELECT "id" FROM "Wheel" ORDER BY "order" LIMIT 1) WHERE "wheelId" IS NULL;

DO $$
BEGIN
    ALTER TABLE "WheelPrize"
        ADD CONSTRAINT "WheelPrize_wheelId_fkey"
        FOREIGN KEY ("wheelId") REFERENCES "Wheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "WheelSpin"
        ADD CONSTRAINT "WheelSpin_wheelId_fkey"
        FOREIGN KEY ("wheelId") REFERENCES "Wheel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
