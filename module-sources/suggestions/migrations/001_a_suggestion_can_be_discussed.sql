-- A suggestion gains a discussion.
--
-- The board counted votes and nothing else, so it could answer "how many
-- people want this" and never "what do they actually want out of it" - which
-- is the part an operator needs before building anything. Comments are the
-- answer, and they carry a moderation state for the same reason the
-- suggestion itself does: anyone with an account can write one.
--
-- Additive. Nothing existing is read or rewritten.

CREATE TABLE IF NOT EXISTS "SuggestionComment" (
    "id"              TEXT NOT NULL,
    "content"         TEXT NOT NULL,
    "moderationState" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "suggestionId"    TEXT NOT NULL,
    "authorId"        TEXT,
    CONSTRAINT "SuggestionComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SuggestionComment_suggestionId_createdAt_idx"
    ON "SuggestionComment" ("suggestionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SuggestionComment_authorId_idx"
    ON "SuggestionComment" ("authorId");
CREATE INDEX IF NOT EXISTS "SuggestionComment_moderationState_idx"
    ON "SuggestionComment" ("moderationState");

DO $$
BEGIN
    ALTER TABLE "SuggestionComment"
        ADD CONSTRAINT "SuggestionComment_suggestionId_fkey"
        FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "SuggestionComment"
        ADD CONSTRAINT "SuggestionComment_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The board lists the public, approved suggestions, and the resolver behind
-- /suggestions/<id> asks the same question one row at a time. `visibility`
-- was on no index at all, so both were a sequential scan over the table.
CREATE INDEX IF NOT EXISTS "Suggestion_visibility_moderationState_idx"
    ON "Suggestion" ("visibility", "moderationState");
