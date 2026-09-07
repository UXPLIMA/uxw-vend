-- The forum's front page is read pinned first, then newest.
--
-- The query is `order by isPinned desc, createdAt desc, take 20`, and the
-- table carried an index on `createdAt` alone. A single-column index cannot
-- serve a two-key sort, so Postgres read every topic and sorted them to hand
-- back twenty - on the page every visitor lands on, growing with the forum.
--
-- Measured on 4000 topics: 316 shared buffers and 2.10ms without it, 4 buffers
-- and 0.043ms with. The number is not the point; the shape is. The old plan
-- walks the whole table, the new one stops after twenty.
--
-- `(isPinned, createdAt)` rather than `(categoryId, isPinned, createdAt)`,
-- which was measured too: the category-first index serves a board listing
-- equally well but sends the unfiltered front page back to a sequential scan,
-- and the front page is the one everybody loads.
--
-- Nothing is dropped: `createdAt` alone still answers the stats screen's date
-- window.
--
-- Safe to run on a fresh install, where the index already exists, and safe to
-- re-run.

CREATE INDEX IF NOT EXISTS "ForumTopic_isPinned_createdAt_idx"
    ON "ForumTopic" ("isPinned", "createdAt");
