-- This module said `issued` for something it had not done.
--
-- It creates a sales invoice in the accounting service and stopped there.
-- Turning that record into a legal e-document is a second call it does not
-- make, so every row reading `issued` told an operator their invoicing
-- obligation was met when only half of it had been.
--
-- Two changes, and neither loses anything.
--
-- `issued` becomes `recorded`, which is what actually happened: the sale is
-- in the accounting service. The old rows are moved rather than left, because
-- a screen that reads both words has to know both for ever, and the word was
-- wrong on the day it was written as much as it is today.
--
-- `legalDocument` is added, saying where the e-document stands. It has one
-- value now - nothing here asks for one - and the column exists so that the
-- day the second call lands, the answer has somewhere true to live instead of
-- being inferred from a status that has never meant it.

ALTER TABLE "IssuedInvoice"
    ADD COLUMN IF NOT EXISTS "legalDocument" TEXT NOT NULL DEFAULT 'not_requested';

UPDATE "IssuedInvoice" SET "status" = 'recorded' WHERE "status" = 'issued';

CREATE INDEX IF NOT EXISTS "IssuedInvoice_legalDocument_idx"
    ON "IssuedInvoice" ("legalDocument");
