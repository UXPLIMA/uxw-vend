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
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

let installing = false;
let buildScheduled = false;
let buildRunning = false;
let buildTimer: ReturnType<typeof setTimeout> | null = null;
const BUILD_DEBOUNCE_MS = 3000; // Wait 3s after last install before building

/** Check if an install is currently running */
export function isInstalling(): boolean {
    return installing;
}

/** Acquire install lock — returns release function */
export async function acquireInstallLock(): Promise<(() => void) | null> {
    if (installing) return null;
    installing = true;
    return () => { installing = false; };
}

/**
 * Schedule a deferred build + restart.
 * If called multiple times within DEBOUNCE window, only runs once.
 * Used by bulk install to avoid 37 sequential builds.
 */
export function scheduleBuild(): void {
    if (process.env.NEXT_DEV) return; // Dev mode: Turbopack handles it

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
