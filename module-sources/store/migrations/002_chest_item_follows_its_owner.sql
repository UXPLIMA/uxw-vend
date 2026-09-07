-- A chest item outlived the account it belonged to, and blocked it.

-- `ChestItem.user` was the one relation of the forty-three pointing at `User`
-- that named no `onDelete`, so Prisma chose for it: a required relation
-- defaults to RESTRICT, which does not merely keep the row, it refuses the
-- delete. Nineteen sibling relations cascade and twenty-three null out.
--
-- Nothing has hit it because deletion here anonymises the User row rather than
-- removing it, so the constraint has never been asked. That is what makes it
-- worth changing now rather than the first time something does ask.
--
-- Cascade is the answer rather than SET NULL because `userId` is not nullable
-- and an unowned chest item is not a record of anything: it is an inventory
-- line for an account that no longer exists. Nothing else reads it.
--
-- What is lost: on a real `DELETE` of a user, that user's chest rows go with
-- them. That is the intent. No existing row changes, and no existing delete
-- path performs such a delete today.
--
-- Safe to re-run: the constraint is dropped only if present and recreated with
-- the same name Prisma expects.

ALTER TABLE "ChestItem" DROP CONSTRAINT IF EXISTS "ChestItem_userId_fkey";

ALTER TABLE "ChestItem"
    ADD CONSTRAINT "ChestItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON UPDATE CASCADE ON DELETE CASCADE;
