-- A support desk had one form for everybody and one door for everybody.
--
-- Two additions, and both are about a department rather than a ticket.
--
-- The extra questions. A billing department wants an order number, a bug
-- report wants a version. The answers are stored on the ticket with the label
-- each question had at the time: looking a label up when a ticket is read
-- loses every old ticket its questions the day an operator renames or deletes
-- a field, and those tickets are still in the queue being read.
--
-- The permissions. A department with no rows is open to everybody, so this
-- does not shut a desk that already works; one with rows that do not name a
-- role is shut to it, because once a list exists the list is the answer.
--
-- Additive: a desk with no rows in either table behaves exactly as before.
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "fieldAnswers" JSONB;

CREATE TABLE IF NOT EXISTS "TicketDepartmentField" (
  "id"           TEXT PRIMARY KEY,
  "departmentId" TEXT NOT NULL REFERENCES "TicketDepartment"("id") ON DELETE CASCADE,
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "type"         TEXT NOT NULL DEFAULT 'text',
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "options"      TEXT[] NOT NULL DEFAULT '{}',
  "order"        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TicketDepartmentField_departmentId_key_key" UNIQUE ("departmentId", "key")
);
CREATE INDEX IF NOT EXISTS "TicketDepartmentField_departmentId_order_idx"
  ON "TicketDepartmentField"("departmentId", "order");

CREATE TABLE IF NOT EXISTS "TicketDepartmentPermission" (
  "id"           TEXT PRIMARY KEY,
  "departmentId" TEXT NOT NULL REFERENCES "TicketDepartment"("id") ON DELETE CASCADE,
  "roleId"       TEXT NOT NULL,
  "canView"      BOOLEAN NOT NULL DEFAULT true,
  "canPost"      BOOLEAN NOT NULL DEFAULT true,
  "canReply"     BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "TicketDepartmentPermission_departmentId_roleId_key" UNIQUE ("departmentId", "roleId")
);
CREATE INDEX IF NOT EXISTS "TicketDepartmentPermission_roleId_idx"
  ON "TicketDepartmentPermission"("roleId");
