// Docker first-boot database bootstrap.
//
// Run by the `migrate` service in docker-compose.yml before the app starts.
// On a FRESH database it pushes the (core-only) schema and seeds the 3 roles
// + core permissions + admin user, so the documented one-command quickstart
// (`docker compose up`) yields a working login out of the box.
//
// It is a NO-OP once the database is already initialized (the core `User`
// table exists), so it is safe to run on every `docker compose up` and never
// touches module-owned tables an admin created at runtime.

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

    if (initialized) {
        console.log("[bootstrap] Database already initialized — skipping schema push + seed.");
        return;
    }

    console.log("[bootstrap] Fresh database — pushing schema and seeding core data…");
    run("prisma db push", "npx", ["prisma", "db", "push", "--skip-generate"]);
    run("seed", "npx", ["tsx", "prisma/seed.ts"]);
    console.log("[bootstrap] Done.");
}

main().catch((err) => {
    console.error("[bootstrap] Unexpected error:", err);
    process.exit(1);
});
