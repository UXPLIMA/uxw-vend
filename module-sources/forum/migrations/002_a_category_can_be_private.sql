-- Forum categories had no permissions and no tree.
--
-- Two silences that mean opposite things: a category with no rules at all is
-- open to everybody, so installing this does not switch off every category on
-- every existing site; a category with rules that do not name a role is shut
-- to it, because once an operator has written a list the list is the answer.
--
-- The tree exists so a section can hold sections. A child is never more open
-- than its parent, which is checked when the question is asked rather than
-- when the parent is set: an operator produces that shape by moving a
-- category, not by writing a rule.
--
-- Additive. A site with no rows in the new table behaves exactly as before.
ALTER TABLE "ForumCategory" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "ForumCategory_parentId_idx" ON "ForumCategory"("parentId");

CREATE TABLE IF NOT EXISTS "ForumCategoryPermission" (
  "id"         TEXT PRIMARY KEY,
  "categoryId" TEXT NOT NULL REFERENCES "ForumCategory"("id") ON DELETE CASCADE,
  "roleId"     TEXT NOT NULL,
  "canView"    BOOLEAN NOT NULL DEFAULT true,
  "canPost"    BOOLEAN NOT NULL DEFAULT true,
  "canReply"   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ForumCategoryPermission_categoryId_roleId_key" UNIQUE ("categoryId", "roleId")
);
CREATE INDEX IF NOT EXISTS "ForumCategoryPermission_roleId_idx" ON "ForumCategoryPermission"("roleId");
