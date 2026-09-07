/**
 * Process lifecycle entry point.
 *
 * Next calls `register()` exactly once per server instance, before the first
 * request is handled. That is the correct home for process-wide setup, and it
 * is why this file exists: hook, scheduler and search-index bootstrap used to
 * hang off the root layout, which meant they ran on a *render*. A render is
 * the wrong trigger for process setup - it is per-request, per-locale, and it
 * never runs at all for a request that terminates in the proxy or in an API
 * route, so a container serving only `/api/...` had no scheduler.
 *
 * Everything here is idempotent; `register()` firing once is the contract, not
 * an assumption we rely on.
 */

export async function register(): Promise<void> {
    // `register` is invoked in every runtime Next compiles for. The edge
    // runtime has no Prisma, no timers we want, and no filesystem - the whole
    // bootstrap belongs to the Node.js server only.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    // Imported inside the guard so the edge bundle never pulls Prisma in.
    const { bootstrapHooks } = await import("@/core/lib/hooks-bootstrap");
    const { bootstrapScheduler } = await import("@/core/lib/scheduler");
    const { installShutdownHandlers } = await import("@/core/lib/shutdown");
    const { warnIfProxyTrustUnconfigured } = await import("@/core/lib/rate-limit");

    // Install first. If bootstrap below throws, a SIGTERM must still unwind
    // Prisma and any interval already registered.
    installShutdownHandlers();

    // One line, once, if the caller's address cannot be verified. Rate limits
    // and IP blocks both key on it, and an operator behind an undeclared proxy
    // would otherwise have no way to find out.
    warnIfProxyTrustUnconfigured();

    try {
        await bootstrapHooks();
    } catch (err) {
        console.error("[instrumentation] hook bootstrap failed:", err instanceof Error ? err.message : String(err));
    }

    try {
        await bootstrapScheduler();
    } catch (err) {
        console.error("[instrumentation] scheduler bootstrap failed:", err instanceof Error ? err.message : String(err));
    }

    // An update in flight is closed out by the boot that follows it, because
    // the process saying "it arrived" is the version that arrived. See
    // core-update.ts; this is the only place that knows both the database and
    // what the site's maintenance setting was before the swap.
    try {
        const { reconcileUpdate } = await import("@/core/lib/core-update");
        const { getMaintenanceConfig, setMaintenanceConfig } = await import("@/core/lib/maintenance");
        const { prisma } = await import("@/core/lib/db");
        const pkg = await import("../package.json");

        const result = await reconcileUpdate(pkg.default.version, async (outcome, intent) => {
            await prisma.coreUpdate.updateMany({
                where: { toVersion: intent.toVersion, status: { in: ["requested", "running"] } },
                data: { status: outcome, finishedAt: new Date() },
            });
        });
        if (result.reopened) {
            const config = await getMaintenanceConfig();
            await setMaintenanceConfig({ ...config, enabled: false });
        }
        if (result.outcome) {
            console.log(`[instrumentation] update ${result.outcome}`);
        }
    } catch (err) {
        console.error("[instrumentation] update reconcile failed:", err instanceof Error ? err.message : String(err));
    }

    // Fire-and-forget: index creation is a background optimisation and must
    // not hold the server back from accepting requests.
    void import("../scripts/ensure-search-indexes")
        .then(({ ensureIndexes }) => ensureIndexes())
        .catch((err: unknown) => {
            console.warn("[instrumentation] search index bootstrap failed:", err instanceof Error ? err.message : String(err));
        });
}
