# Database Migration System

## Two Systems, Two Purposes

uxwVend uses two distinct schema management mechanisms. Understanding when each applies is critical.

### 1. Core schema — `prisma db push`

The core schema (`prisma/schema.core.prisma`) and its merged output (`prisma/schema.prisma`) are managed with **`prisma db push`**, not `prisma migrate`. There is no `prisma/migrations/` directory for core.

`db push` introspects the current database and applies the diff to reach the schema declared in `schema.prisma`. It is appropriate here because:

- The core schema is stable and rarely changes
- Development and production use the same PostgreSQL instance type
- No migration history is required for the core framework models

Run a core schema change:

```bash
# After editing prisma/schema.core.prisma:
npm run db:merge     # regenerates prisma/schema.prisma from core + all module schemas
npm run db:push      # applies the diff to the database
```

**Never run `prisma migrate dev` or `prisma migrate deploy` against this repository.** The project does not use Prisma's migration engine.

### 2. Module schema changes — SQL migrations

When an installed module needs to alter its database schema after initial deployment (add a column, rename a field, create a new table), it uses the **per-module SQL migration system** described in the rest of this document.

---

## Per-Module SQL Migrations

### Design

Each module can ship a `migrations/` directory alongside its `schema.prisma`. Files are plain SQL, named with a zero-padded sequence prefix:

```
module-sources/<module-id>/
  schema.prisma           ← still merged for Prisma Client type generation
  migrations/
    001_init.sql          ← CREATE TABLE statements
    002_add_slug.sql      ← ALTER TABLE, new columns
    003_rename_field.sql  ← safe data-preserving rename
```

- File names follow the pattern `NNN_description.sql` where `NNN` is a zero-padded sequence number.
- Each file is a single atomic migration. The runner wraps every file in a database transaction.
- Do not add `BEGIN` / `COMMIT` inside the file — the runner handles transaction boundaries.
- SQL dialect is PostgreSQL.

### Tracking table

Applied migrations are recorded in the `ModuleMigration` table (defined in `prisma/schema.core.prisma`):

```
ModuleMigration
  id            String   @id @default(cuid())
  moduleId      String
  migrationName String
  checksum      String   (SHA-256 of file contents)
  appliedAt     DateTime @default(now())
  executionMs   Int?

  @@unique([moduleId, migrationName])
```

The `@@unique([moduleId, migrationName])` constraint ensures idempotency — a migration file can never be applied twice for the same module.

### Runner: `scripts/apply-migrations.ts`

The runner is also aliased as `npm run db:migrate`.

**For each installed module (or a specific module when `--module=<id>` is given):**

1. Resolve the migrations directory. Prefers `src/modules/<id>/migrations/` (the installed copy); falls back to `module-sources/<id>/migrations/` (source tree).
2. List `.sql` files sorted by filename.
3. For each file, compute the SHA-256 checksum and look up the `ModuleMigration` record.
4. **Already applied + checksum matches** → skip (up to date).
5. **Already applied + checksum mismatch** → **abort with an error**. An applied migration was modified. This is a bug — write a new forward migration instead.
6. **Not yet applied** → execute inside a transaction, then record the `ModuleMigration` row with the checksum and execution time.
7. On any error, abort processing for that module. Do not skip ahead to the next migration file.

The runner exits with code 1 if any error occurred.

---

## CLI Usage

```bash
# Apply all pending migrations for all installed modules
npm run db:migrate
# equivalent:
npx tsx scripts/apply-migrations.ts

# Apply only for a specific module
npx tsx scripts/apply-migrations.ts --module=blog

# Preview what would be applied without touching the database
npx tsx scripts/apply-migrations.ts --dry-run

# Bootstrap mode: mark existing migrations as applied without executing them
# (used when seeding the ModuleMigration table against an existing database)
npx tsx scripts/apply-migrations.ts --bootstrap

# Combine flags
npx tsx scripts/apply-migrations.ts --module=blog --dry-run
```

npm script aliases for convenience:

```bash
npm run db:migrate             # apply all
npm run db:migrate:dry         # dry-run all
npm run db:migrate:bootstrap   # bootstrap all
```

---

## Writing a Migration

### When to write a SQL migration

Write a migration whenever you need to change the database schema of an already-deployed module — adding a column, renaming a field, creating a new table, adding an index, seeding lookup data, etc.

For a **brand new module** that has never been deployed, `001_init.sql` is sufficient — `db:push` will apply the Prisma schema on first install, and the migration file just needs to match that schema for the bootstrap step.

### File naming

```
NNN_short_description.sql
```

- `NNN` starts at `001` and increments by 1.
- Use lowercase with underscores.
- Keep descriptions short: `002_add_slug`, `003_backfill_status`, `004_drop_legacy_column`.

The runner sorts files lexicographically, so the sequence prefix governs order.

### Example: adding a column

`module-sources/blog/migrations/002_add_published_at.sql`:

```sql
ALTER TABLE "BlogPost" ADD COLUMN "publishedAt" TIMESTAMPTZ;
```

The runner wraps this in a transaction automatically.

### Example: seeding lookup data

```sql
INSERT INTO "BlogCategory" (id, name, slug)
VALUES (gen_random_uuid(), 'General', 'general')
ON CONFLICT (slug) DO NOTHING;
```

### Example: safe column rename (two-step)

PostgreSQL does not support renaming a column atomically without risk. Use two migrations:

`003_add_new_column.sql`:
```sql
ALTER TABLE "BlogPost" ADD COLUMN "excerpt" TEXT;
UPDATE "BlogPost" SET "excerpt" = "summary";
```

`004_drop_old_column.sql` (deploy after verifying application code uses the new column):
```sql
ALTER TABLE "BlogPost" DROP COLUMN "summary";
```

---

## Integration with Module Install

When an admin installs a module through the UI:

1. Files are extracted to `src/modules/<id>/`.
2. The registry is regenerated synchronously (install aborts if this fails).
3. `applyMigrations({ moduleFilter: id })` is called for just that module.
4. The `ModuleConfig` row is created.
5. Translations are synced.

On subsequent module updates, the same flow runs. New migration files in the updated ZIP are applied in sequence; already-applied files are skipped.

### Deferred build

After one or more module installs, `scheduleBuild()` fires a debounced background job:

```
db:merge → apply-migrations (all) → generate-registry → npm run build → pm2 restart
```

The 3-second debounce ensures bulk installs (e.g., installing five modules in quick succession) trigger only one rebuild.

---

## Bootstrapping an Existing Database

If you are adding the migration system to a module that already has tables in a live database (from previous `db:push` runs), use bootstrap mode:

1. Write `001_init.sql` that matches the current table state exactly (as if creating the tables from scratch).
2. Run the bootstrap command:
   ```bash
   npx tsx scripts/apply-migrations.ts --module=your-module --bootstrap
   ```
3. This marks `001_init.sql` as applied (records it in `ModuleMigration`) **without executing the SQL**. The existing tables are untouched.
4. All future migrations (`002_*.sql`, etc.) will execute normally.

---

## Safety Guarantees

**Checksum verification on every run.** Before executing a pending migration, the runner computes a fresh SHA-256 of the file. If the file was already applied and the checksum does not match the stored value, the runner aborts. This prevents silently running modified migrations against production.

**Transaction-wrapped.** Every migration file executes inside a single `BEGIN ... COMMIT` transaction. If the SQL fails partway through, the entire file is rolled back. The `ModuleMigration` record is only written after the transaction commits successfully.

**Abort-on-first-error per module.** If migration `002_add_slug.sql` fails, the runner does not attempt `003_rename_field.sql`. Skipping ahead in sequence could leave the schema in an inconsistent state.

**Advisory lock on install.** The module install route acquires a PostgreSQL advisory lock (`pg_try_advisory_lock`) so concurrent installs in a PM2 cluster cannot race each other.

---

## Rollback

V1 does **not** support automatic rollback or `.down.sql` files.

If a migration needs to be undone:

1. Manually run the reverse SQL against the database (e.g., `ALTER TABLE ... DROP COLUMN ...`).
2. Delete the `ModuleMigration` row for that migration file from the database:
   ```sql
   DELETE FROM "ModuleMigration"
   WHERE "moduleId" = 'your-module' AND "migrationName" = '003_bad_migration.sql';
   ```
3. Write a new forward migration (e.g., `004_revert_003.sql`) that puts the schema in the desired state and commit it.

This forward-only approach keeps the migration log append-only and auditable. Every state the database has ever been in corresponds to a specific sequence of checked-in SQL files.

---

## Schema Merging and Type Generation

`scripts/merge-schemas.ts` reads `prisma/schema.core.prisma` and all `module-sources/<id>/schema.prisma` files, merges them into `prisma/schema.prisma`, and runs `prisma generate` to produce the TypeScript Prisma Client.

This merged schema is used **only for type generation**. The actual database schema is managed by:
- `prisma db push` for core models
- SQL migration files for module models

Run the merge manually:

```bash
npm run db:merge
```

The merge runs automatically via the `predev` and `prebuild` hooks. You do not need to run it manually before `npm run dev` or `npm run build`.

### Module User relations

If a module needs to add fields to the `User` model (e.g., a `StoreOrders` relation), declare them in `module-sources/<id>/schema.prisma` inside the special comment block:

```prisma
// @@user-relations-start
orders StoreOrder[] @relation("UserOrders")
// @@user-relations-end
```

`merge-schemas.ts` injects these fields into the `User` model at the `// @@MODULE_RELATIONS` marker in `schema.core.prisma`.

---

## Conflict Avoidance

Each module has its own migration sequence — two modules both having a `001_init.sql` is fine because they are keyed by `moduleId + migrationName`.

The only real conflict scenario is two modules defining a Prisma model with the same name. `merge-schemas.ts` detects this as a collision and aborts the merge before any migration can run. Fix it by renaming one of the models.

---

## Common Mistakes

**Editing an applied migration file.** The checksum will mismatch and the runner will abort on the next run. Write a new forward migration instead.

**Using `prisma migrate dev` or `prisma migrate deploy`.** These commands are not used in this project. They will create a `prisma/migrations/` directory and conflict with `db:push`. Do not run them.

**Forgetting to commit the migration file.** The migration is only applied by the runner if the file exists on disk. If you apply it locally but do not commit it, the production deployment will skip it and the schemas will diverge.

**Writing multi-statement migrations with dollar-quoted functions.** The runner uses a single `$executeRawUnsafe` call per file. Complex multi-statement migrations with dollar-quoted procedural SQL (e.g., PL/pgSQL functions) should be tested carefully. For maximum safety, split complex DDL into one statement per file.
