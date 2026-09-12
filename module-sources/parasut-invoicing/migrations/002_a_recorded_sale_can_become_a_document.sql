-- The sale can become a legal document now, so the row can say where it got to.
--
-- `legalDocument` has had one value since it was added, because the module
-- could only record a sale in the accounting service: the second call, the
-- one that puts an e-Fatura or an e-Arşiv in front of the tax authority, was
-- not made. It is made now, and what comes back is a job, then a document,
-- then an answer from the authority - approved or refused.
--
-- Which document a buyer was owed matters after the fact as much as before
-- it: an e-Fatura and an e-Arşiv are filed in different registers, and an
-- operator looking at a refusal needs to know which one was sent.
--
-- Additive and forward-only. Rows already here keep `not_requested`, which is
-- what they are: nobody asked for a document for those sales.

ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalKind" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalJobId" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalRemoteId" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalNumber" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalReason" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "legalAt" TIMESTAMP(3);

-- What a document needs and only the sale knows. Kept here so asking for one
-- later reads this module's own row: a module reaching into the shop's orders
-- for three fields is the thing `a-module-owns-what-it-reads` forbids, and
-- the sale may have been anonymised by then anyway.
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "buyerTaxNumber" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "IssuedInvoice" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
