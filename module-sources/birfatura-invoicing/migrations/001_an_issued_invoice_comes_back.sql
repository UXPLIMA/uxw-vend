-- The invoice the integrator issues now comes back and is written down.
--
-- This module answered questions about orders and kept nothing: it handed
-- over sales and never heard what happened to them, so an operator could not
-- tell an invoiced order from one nobody had touched, and the link to the
-- document a customer may ask for lived only in the integrator's system.
--
-- `/api/invoiceLinkUpdate` is the call that brings it back, keyed on the
-- order because the integrator repeats it when an invoice is reissued: one
-- row per order, updated, not a second invoice that does not exist.
--
-- Additive and forward-only, and safe to re-run.

CREATE TABLE IF NOT EXISTS "ShopInvoice" (
    "id"        TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "number"    TEXT,
    "issuedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopInvoice_orderId_key" ON "ShopInvoice" ("orderId");
CREATE INDEX IF NOT EXISTS "ShopInvoice_createdAt_idx" ON "ShopInvoice" ("createdAt");
