// Docker database bootstrap AND upgrade.
//
// Run by the `migrate` service in docker-compose.yml before the app starts,
// on every `up`. It has two jobs, decided by whether the core `User` table
// already exists:
//
//   FRESH database  — merge schemas, push, and seed the 3 roles + core
//                     permissions + admin user, so `install.sh` yields a
//                     working login out of the box.
//
//   EXISTING database — run the upgrade sequence documented in
//                     docs/DEPLOYMENT.md ("Upgrades") and docs/MIGRATIONS.md:
//                     merge-schemas -> prisma db push -> apply-migrations.
//                     It used to return early here, which meant pulling a
//                     newer image left the database on the old schema: the
//                     install was one command, the upgrade was silently
//                     broken. Seeding is NEVER repeated.
//
// merge-schemas reads src/modules, so the `migrate` service mounts the same
// `modules` volume the app does — otherwise the merged schema would be
// core-only and `db push` would try to drop every table the installed
// modules own.
//
// If any step fails the service exits non-zero and the app never starts
// (`depends_on: service_completed_successfully`). That is deliberate: a
// running app on a mismatched schema is worse than a stopped one.

// Reads DATABASE_URL from .env — this script is run directly via tsx,
// outside Next.js, which is what normally loads the env file.
import "dotenv/config";
import { Pool } from "pg";
import { spawnSync } from "child_process";

async function isInitialized(pool: Pool): Promise<boolean> {
    try {
        const r = await pool.query(`SELECT to_regclass('public."User"') AS t`);
        return r.rows[0]?.t != null;
    } catch {
        // Connection/SQL error → treat as not-initialized; the push below will
        // surface the real error if the DB is genuinely unreachable.
        return false;
    }
}

function run(label: string, cmd: string, args: string[]): void {
    const result = spawnSync(cmd, args, { stdio: "inherit" });
    if (result.status !== 0) {
        console.error(`[bootstrap] ${label} failed (exit ${result.status}).`);
        process.exit(result.status ?? 1);
    }
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        console.error("[bootstrap] DATABASE_URL is not set.");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let initialized = false;
    try {
        initialized = await isInitialized(pool);
    } finally {
        await pool.end();
    }

    // Rebuild prisma/schema.prisma from the core schema plus whatever modules
    // are installed in the mounted volume right now. On a fresh install that
    // is core-only; on an upgrade it is core + every module the admin added,
    // which is what makes the `db push` below safe.
    run("merge-schemas", "npx", ["tsx", "scripts/merge-schemas.ts"]);
    // No --skip-generate: Prisma 7 removed the flag (`prisma db push` accepts
    // only --config, --schema, --url, --accept-data-loss and --force-reset),
    // and passing it aborts the push. merge-schemas.ts above already ran
    // `prisma generate`, so there is nothing to skip.
    run("prisma db push", "npx", ["prisma", "db", "push"]);

    if (initialized) {
        console.log("[bootstrap] Existing database — applying module migrations…");
        run("apply-migrations", "npx", ["tsx", "scripts/apply-migrations.ts"]);
        console.log("[bootstrap] Upgrade complete.");
        return;
    }

    console.log("[bootstrap] Fresh database — seeding core data…");
    run("seed", "npx", ["tsx", "prisma/seed.ts"]);
    console.log("[bootstrap] Done.");
}

main().catch((err) => {
    console.error("[bootstrap] Unexpected error:", err);
    process.exit(1);
});
