-- A product can be sold to certain ranks only.
--
-- The wheel already had this and the shop did not, so a community selling a
-- VIP-only crate had to police it by hand afterwards. Empty means anyone,
-- which is every product that exists today.
--
-- The list advertises a rank-gated product rather than hiding it: the listing
-- is shared-cached and cannot vary by who is reading, and somebody who cannot
-- buy it yet is exactly the person who might buy the rank.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
