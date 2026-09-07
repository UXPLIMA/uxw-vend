-- Submissions are listed newest first, with nothing narrowing them.
--
-- The admin list is `orderBy createdAt desc` over the whole table, a page at
-- a time, so every page load sorts every submission ever sent. Nothing is
-- dropped here: formId keeps its own index, because a single form's
-- submissions are still looked up that way.
--
-- Safe on a fresh install and safe to re-run.

CREATE INDEX IF NOT EXISTS "CustomFormSubmission_createdAt_idx"
    ON "CustomFormSubmission" ("createdAt");
