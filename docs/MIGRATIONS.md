# Database Migration System

## Problem

Until now, uxwVend used `prisma db push --accept-data-loss` to sync schema changes. This approach has critical gaps:

- **No version history** — can't tell what changed or when
- **No rollback** — destructive changes are permanent the instant they're applied
- **No audit trail** — `db push` is silent about what it did
- **No data-safe migration path** — renaming a column, splitting a table, etc. all lose data
- **No per-module ownership** — a single merged schema means one module's schema change can accidentally affect another

This document describes the replacement: a per-module versioned SQL migration system.

## Design: Per-module SQL migrations

Each module ships its own migrations directory with sequential SQL files. The core `ModuleMigration` table tracks which migrations have been applied per module.

### File layout

```
module-sources/<module>/
  schema.prisma           ← still merged for Prisma Client type generation
  migrations/
    001_init.sql          ← CREATE TABLE statements
    002_add_slug.sql      ← ALTER TABLE / new column
    003_rename_field.sql  ← safe data-preserving rename
    ...
```

- Files are named `NNN_description.sql` where `NNN` is a zero-padded sequence.
- Each file is a single atomic migration — one SQL transaction.
- SQL dialect is PostgreSQL (matching our Prisma datasource).
- No `BEGIN`/`COMMIT` needed inside the file — the runner wraps each file in a transaction.

### Core table

```prisma
model ModuleMigration {
  id           String   @id @default(cuid())
  moduleId     String   // e.g. "blog"
  migrationName String  // e.g. "001_init.sql"
  checksum     String   // SHA-256 of file contents
  appliedAt    DateTime @default(now())
  executionMs  Int?

  @@unique([moduleId, migrationName])
  @@index([moduleId])
}
```

### Runner: `scripts/apply-migrations.ts`

- Lists installed modules (same logic as merge-schemas)
- For each module:
  1. Read migrations/ directory, sorted by filename
  2. For each file, compute checksum and check if already applied (by name)
  3. If not applied: run inside a transaction, record in `ModuleMigration`
  4. If checksum differs from recorded checksum: ABORT with an error (someone edited an already-applied migration; that is a bug)
- Logs applied + skipped counts

### Integration points

1. **Fresh install**: `npm run db:migrate` → runs core migrations + all module migrations
2. **Module install**: after extracting the ZIP, install route calls `applyMigrations(moduleId)` for just that module
3. **Module update**: same flow — new migration files are applied in order
4. **Module uninstall**: **data is preserved by default** (we do NOT run down migrations). Users can manually drop tables via a separate cleanup endpoint. This matches WordPress convention (uninstall leaves data for re-install).

### Schema merging still happens

`merge-schemas.ts` continues to merge all module schemas into `prisma/schema.prisma` for **Prisma Client type generation only** — not for DB sync.

- Run `npm run db:merge` → generates Prisma Client with types for all models
- Run `npm run db:migrate` → applies only NEW migrations to the actual DB

This separation means: your TypeScript code always has types for every installed module's models, but the DB only changes when you explicitly migrate.

### Rollback

V1 does **not** support automatic rollback. Migrations are forward-only. If a migration is bad:

1. Manually run a reverse SQL against the DB
2. Delete the `ModuleMigration` record
3. Write a new migration `NNN_revert_xxx.sql` that fixes the situation

V2 may add optional `.down.sql` files alongside each migration.

### Migration conflicts between modules

Not an issue under this design — each module has its own sequence. Two modules both adding a `status` column to different tables won't conflict.

The only conflict scenario: two modules trying to create a table with the same name. This is already prevented by `merge-schemas.ts`'s model-collision check (run before migration).

## Command-line interface

```bash
# Generate a new migration file (manual SQL authoring)
npx tsx scripts/new-migration.ts <module> <description>
# → creates module-sources/<module>/migrations/NNN_<description>.sql

# Apply all pending migrations for all installed modules
npm run db:migrate

# Apply only for a specific module
npm run db:migrate -- --module=blog

# Dry-run (show what would be applied)
npm run db:migrate -- --dry-run

# Merge schemas for type generation (existing command)
npm run db:merge
```

## Migration from `db push` to this system

For the CURRENT database (which was pushed many times), we need a one-time bootstrap:

1. Add `ModuleMigration` to core schema, run final `db push` to create the table
2. For each already-installed module with a DB schema: create a `001_init.sql` that matches the current state, and insert a `ModuleMigration` record marking it as already applied (skip actual execution)
3. Going forward, all new changes go through migration files

Bootstrap script: `scripts/bootstrap-migrations.ts` — marks the current state as the baseline without touching data.

## Trade-offs

- **Pro**: Every schema change is an auditable, reviewable SQL file in git
- **Pro**: Production-safe — no more `--accept-data-loss`
- **Pro**: Per-module isolation matches the motto
- **Pro**: Compatible with existing Prisma Client type generation
- **Con**: More manual work — developers write SQL instead of editing the Prisma schema and running `db push`
- **Con**: SQL is PostgreSQL-specific (we only support PG anyway)
- **Con**: V1 has no rollback (acceptable for forward-only workflow)
