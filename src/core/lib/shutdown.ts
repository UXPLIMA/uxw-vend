/**
 * Cooperative shutdown registry.
 *
 * PM2 graceful reload, Docker stops, and `systemctl stop` all send SIGTERM
 * and give the process a grace window (10-30s typically) before hard-kill.
 * Without explicit handling, in-flight requests get cut off, Prisma TCP
 * connections are dropped mid-query, and the scheduler's setInterval keeps
 * the event loop alive. All three hurt in different ways: data loss, pool
 * exhaustion on the next boot, and a hanging process that PM2 SIGKILLs.
 *
 * Modules and core libraries register callbacks here; the signal handler
 * runs them in reverse registration order so late-init code (scheduler)
 * unwinds before early-init code (Prisma).
 */

type ShutdownCallback = () => Promise<void> | void;

interface Registration {
    name: string;
    fn: ShutdownCallback;
}

const callbacks: Registration[] = [];
let installed = false;
let shuttingDown = false;

/**
 * Register a cleanup callback. Safe to call multiple times with the same
 * name — later registrations replace the earlier one so hot-reload / test
 * re-imports don't stack duplicates.
 */
export function onShutdown(name: string, fn: ShutdownCallback): void {
    const existingIndex = callbacks.findIndex((c) => c.name === name);
    if (existingIndex >= 0) {
        callbacks[existingIndex] = { name, fn };
    } else {
        callbacks.push({ name, fn });
    }
}

/**
 * Execute all registered callbacks in reverse order. Each runs inside its
 * own try/catch so one broken handler can't leave later ones uncalled.
 * Callers should not invoke this directly — the signal handler does.
 */
async function runShutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, draining ${callbacks.length} handlers`);

    for (const entry of [...callbacks].reverse()) {
        try {
            const result = entry.fn();
            if (result instanceof Promise) {
                await result;
            }
        } catch (err) {
            console.error(`[shutdown] ${entry.name} failed:`, err);
        }
    }
    console.log("[shutdown] drain complete");
}

/**
 * Install SIGTERM / SIGINT handlers exactly once per process. Call from
 * any server-entry module — the install flag makes repeat calls cheap.
 * A max-grace timeout guards against a buggy handler that hangs: we
 * force-exit after N seconds so PM2 doesn't have to SIGKILL us.
 */
export function installShutdownHandlers(): void {
    if (installed) return;
    installed = true;

    const maxGraceMs = (() => {
        const raw = Number(process.env.SHUTDOWN_GRACE_MS);
        return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
    })();

    const handle = (signal: NodeJS.Signals) => {
        const forceExit = setTimeout(() => {
            console.error(`[shutdown] grace window of ${maxGraceMs}ms exceeded, forcing exit`);
            process.exit(1);
        }, maxGraceMs);
        forceExit.unref();

        runShutdown(signal)
            .finally(() => {
                clearTimeout(forceExit);
                process.exit(0);
            });
    };

    process.once("SIGTERM", handle);
    process.once("SIGINT", handle);
}

export function isShuttingDown(): boolean {
    return shuttingDown;
}
