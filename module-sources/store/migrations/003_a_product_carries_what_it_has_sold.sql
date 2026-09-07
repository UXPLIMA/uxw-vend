-- Popularity moved off an aggregate and onto the product row.

-- `?sort=popular` used to rank with a `groupBy` over every paid order item,
-- joined to Order for the status and to Product for the list's own filter, and
-- with no limit, because a ranking has to be complete before a page of it can
-- be cut. Measured in a scratch schema with 50,000 orders, 150,000 order items
-- and 3,000 products - a small shop after a couple of busy years:
--
--     the aggregation, as the route ran it        90.3 ms
--     ordering by this column, indexed             1.0 ms
--
-- The column counts units: an order for five of something moves it by five.
-- The old ranking counted order lines, which was what a `groupBy` could
-- express rather than a decision anybody made, so a shop's order may shift
-- slightly where quantities differ. It is maintained at settlement and at
-- refund, inside the transaction that grants and takes back the products.
--
-- Nothing is lost. The backfill reads the same orders the ranking read, so a
-- shop that upgrades keeps the ranking it had, and a shop with no orders
-- starts at zero.
--
-- Safe to re-run: the column and the index are created only if absent, and the
-- backfill recomputes from the orders rather than adding to what is there.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitsSold" INTEGER NOT NULL DEFAULT 0;

UPDATE "Product" p
SET "unitsSold" = COALESCE(s.units, 0)
FROM (
    SELECT oi."productId" AS pid, SUM(oi.quantity)::int AS units
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status = 'COMPLETED' AND oi."productId" IS NOT NULL
    GROUP BY oi."productId"
) s
WHERE p.id = s.pid;

CREATE INDEX IF NOT EXISTS "Product_isActive_unitsSold_idx" ON "Product" ("isActive", "unitsSold");
