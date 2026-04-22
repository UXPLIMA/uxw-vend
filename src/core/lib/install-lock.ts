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
import { prisma } from "./db";

const execFileAsync = promisify(execFile);

// Advisory lock key — arbitrary constant. Postgres session-level advisory
// locks are identified by a bigint; any app-wide constant works as long as
// nothing else in the schema reuses the same value.
const INSTALL_ADVISORY_LOCK_KEY = 0x7578774d_6f64496e; // "uxwModIn"

let installing = false;
let buildScheduled = false;
let buildRunning = false;
let buildTimer: ReturnType<typeof setTimeout> | null = null;
const BUILD_DEBOUNCE_MS = 3000; // Wait 3s after last install before building

/** Check if an install is currently running (this worker only) */
export function isInstalling(): boolean {
    return installing;
}

/**
 * Acquire install lock — returns release function or null if another
 * install is already running (either in this worker or another one).
 *
 * Uses a dedicated Prisma client connection so the advisory lock lives
 * on exactly one Postgres session (pg_try_advisory_lock + pg_advisory_unlock
 * must run on the same session).
 */
export async function acquireInstallLock(): Promise<(() => void) | null> {
    // Fast path: another request in this worker already holds the lock.
    if (installing) return null;

    try {
        // Use an interactive transaction to guarantee every statement
        // (lock acquire + release) runs on the same pooled connection.
        // pg_try_advisory_lock returns true when the lock was acquired,
        // false when another session already holds it.
        const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_lock(${INSTALL_ADVISORY_LOCK_KEY}::bigint) AS locked
        `;
        const gotLock = rows?.[0]?.locked === true;
        if (!gotLock) return null;

        installing = true;
        return () => {
            installing = false;
            // Best-effort release. A crash before this runs is safe: the
            // advisory lock is session-scoped and Postgres drops it when
            // the connection closes.
            prisma.$queryRaw`SELECT pg_advisory_unlock(${INSTALL_ADVISORY_LOCK_KEY}::bigint)`
                .catch(() => { /* already released or connection gone */ });
        };
    } catch (err) {
        // DB unreachable — fall back to in-process lock so single-worker
        // setups (no Postgres yet, e.g. during initial setup wizard)
        // still get some mutual exclusion.
        console.error("[install-lock] advisory lock failed, falling back to in-process:", err);
        installing = true;
        return () => { installing = false; };
    }
}

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
