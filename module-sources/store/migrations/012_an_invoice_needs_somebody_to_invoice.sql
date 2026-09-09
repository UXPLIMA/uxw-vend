-- The shop knew who bought something and nothing a tax authority would accept.
--
-- No legal name, no tax number, no address. Fine until something has to issue
-- a real invoice, at which point the money has been taken and the details
-- nobody asked for cannot be asked for any more.
--
-- Nullable and not backfilled. A shop with nothing issuing invoices never asks
-- for these and every existing order legitimately has none; inventing an
-- identity from an account name would put a wrong one on a legal document.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingDetails" JSONB;
