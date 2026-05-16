/**
 * Module install lock + build queue.
 * Prevents concurrent installs from racing and ensures build runs only once
 * after all pending installs complete.
 *
 * Scenarios handled:
 * 1. Bulk install (37 modules) — build runs ONCE at the end, not 37 times
 * 2. Concurrent install requests — queued, not rejected
 * 3. Build already running — waits for completion
 * 4. PM2 restart debounce — single restart after build
 * 5. Partial install failure — does not block other installs
 *
 * The lock itself is a Postgres advisory lock so two PM2 workers (or two
 * pods) cannot both run an install at the same time. The in-process flag
 * is kept as a fast path so callers in the same worker can early-reject
 * without a round trip.
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Advisory lock key — arbitrary constant. Postgres session-level advisory
// locks are identified by a bigint; any app-wide constant works as long as
// nothing else in the schema reuses the same value. Use a BigInt literal:
// the hex value exceeds Number.MAX_SAFE_INTEGER, so a plain `number` would
// round, and two PM2 workers could compute different float approximations
// and acquire technically different locks (mutual exclusion would silently
// break).
const INSTALL_ADVISORY_LOCK_KEY = BigInt("0x7578774d6f64496e"); // "uxwModIn"

let installing = false;
let buildScheduled = false;
let buildRunning = false;
let buildTimer: ReturnType<typeof setTimeout> | null = null;
const BUILD_DEBOUNCE_MS = 3000; // Wait 3s after last install before building

// Dedicated pg pool with a single connection so the advisory lock acquire
// and release are guaranteed to execute on the same Postgres session.
// Prisma's own connection pool can recycle connections between calls, which
// makes pg_advisory_unlock a no-op when the release lands on a different
// connection — the lock then leaks until the original session is closed.
// Lazily required via eval("require") to keep Turbopack from bundling pg.
type LockClient = {
    query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
    release(): void;
};
type LockPool = { connect(): Promise<LockClient>; end(): Promise<void> };
let lockPool: LockPool | null = null;
function getLockPool(): LockPool {
    if (!lockPool) {
        const _require = typeof __webpack_require__ === "function"
            ? __non_webpack_require__
            : eval("require");
        const { Pool } = _require("pg");
        lockPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }) as LockPool;
    }
    return lockPool;
}

/** Check if an install is currently running (this worker only) */
export function isInstalling(): boolean {
    return installing;
}

/**
 * Acquire install lock — returns release function or null if another
 * install is already running (either in this worker or another one).
 *
 * Holds a dedicated pg client checked out from a single-purpose pool so
 * pg_try_advisory_lock and pg_advisory_unlock run on the same Postgres
 * session. Without this, Prisma's pool may release the unlock on a
 * different physical connection — making it a silent no-op while the
 * lock continues to be held by the original session.
 */
export async function acquireInstallLock(): Promise<(() => void) | null> {
    // Fast path: another request in this worker already holds the lock.
    if (installing) return null;

    let client: LockClient | null = null;
    try {
        client = await getLockPool().connect();
        const result = await client.query<{ locked: boolean }>(
            "SELECT pg_try_advisory_lock($1::bigint) AS locked",
            [INSTALL_ADVISORY_LOCK_KEY.toString()],
        );
        const gotLock = result.rows?.[0]?.locked === true;
        if (!gotLock) {
            client.release();
            return null;
        }

        installing = true;
        const heldClient = client;
        return () => {
            installing = false;
            heldClient
                .query("SELECT pg_advisory_unlock($1::bigint)", [INSTALL_ADVISORY_LOCK_KEY.toString()])
                .catch(() => { /* already released or connection gone */ })
                .finally(() => { try { heldClient.release(); } catch { /* noop */ } });
        };
    } catch (err) {
        if (client) { try { client.release(); } catch { /* noop */ } }
        // DB unreachable — fall back to in-process lock so single-worker
        // setups (no Postgres yet, e.g. during initial setup wizard)
        // still get some mutual exclusion.
        console.error("[install-lock] advisory lock failed, falling back to in-process:", err);
        installing = true;
        return () => { installing = false; };
    }
}

declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;

/**
 * Schedule a deferred build + restart.
 * If called multiple times within DEBOUNCE window, only runs once.
 * Used by bulk install to avoid 37 sequential builds.
 */
export function scheduleBuild(): void {
    // Dev mode: Turbopack handles recompile, skip the production build
    // pipeline. `NEXT_DEV` was a typo — Next.js sets NODE_ENV=development
    // during `next dev`, not a custom NEXT_DEV flag, so the old check
    // was a no-op and full builds ran even while the dev server was up.
    if (process.env.NODE_ENV !== "production") return;

    buildScheduled = true;

    // Clear previous timer
    if (buildTimer) clearTimeout(buildTimer);

    // Debounce: wait for more installs to finish
    buildTimer = setTimeout(async () => {
        if (buildRunning) return; // Another build is already running
        buildRunning = true;
        buildScheduled = false;

        try {
            // 1. Merge schemas (for Prisma Client type generation only — not for DB)
            try {
                await execFileAsync("npx", ["tsx", "scripts/merge-schemas.ts"], {
                    cwd: process.cwd(), timeout: 60000,
                });
            } catch { /* schema merge failed — non-fatal */ }

            // 2. Apply per-module SQL migrations (replaces db push)
            try {
                await execFileAsync("npx", ["tsx", "scripts/apply-migrations.ts"], {
                    cwd: process.cwd(), timeout: 120000,
                });
            } catch { /* migrations failed — non-fatal, but logged */ }

            // 3. Generate registry
            try {
                await execFileAsync("npx", ["tsx", "scripts/generate-registry.ts"], {
                    cwd: process.cwd(), timeout: 30000,
                });
            } catch { /* registry gen failed */ }

            // 4. Build
            await execFileAsync("npm", ["run", "build"], {
                cwd: process.cwd(), timeout: 300000, // 5 min max
            });

            // 5. PM2 restart
            try {
                await execFileAsync("npx", ["pm2", "restart", "uxwvend"], {
                    cwd: process.cwd(), timeout: 10000,
                });
            } catch { /* no PM2 */ }
        } catch {
            // Build failed — will need manual rebuild
        } finally {
            buildRunning = false;

            // If more installs happened during build, schedule another
            if (buildScheduled) {
                scheduleBuild();
            }
        }
    }, BUILD_DEBOUNCE_MS);
}

/** Check if a build is currently running or scheduled */
export function isBuildPending(): boolean {
    return buildRunning || buildScheduled;
}
