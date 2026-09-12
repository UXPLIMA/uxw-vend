-- A punishment says who it is against and who reported it.
--
-- The table was a mirror of one game server's bans: a player name, sometimes
-- a game UUID, and nothing tying either to a member of this site. So the
-- module could not answer the question a site actually asks - "what has this
-- member done?" - and a second source of punishments had nowhere to go.
--
-- `userId` is the member, when anybody knows which member it is: always for
-- one written here, and for one from a game server only where the account was
-- linked and proved. `source` says who recorded it, "site" being an
-- administrator on this site, and `externalRef` is that system's own
-- identifier so a webhook delivered twice updates one row instead of adding
-- another.
--
-- Additive and forward-only. Rows already here keep their player name and
-- become `source = 'site'`, which is what the default says and what they
-- were: there was no other source.

ALTER TABLE "Punishment" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Punishment" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'site';
ALTER TABLE "Punishment" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Punishment_source_externalRef_key"
    ON "Punishment" ("source", "externalRef");
CREATE INDEX IF NOT EXISTS "Punishment_userId_idx" ON "Punishment" ("userId");

DO $$
BEGIN
    ALTER TABLE "Punishment"
        ADD CONSTRAINT "Punishment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
