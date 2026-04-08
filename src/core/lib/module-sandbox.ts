/**
 * Safe-invoke helper for module-contributed code.
 *
 * Wraps any module-side function call in a try/catch so a buggy module
 * can't crash the request pipeline. Logs the error with module context
 * and returns a fallback value. Also writes a best-effort audit row to
 * ActivityLog so admins can see runtime failures from the dashboard.
 *
 * Example:
 *   const results = await safeCall(
 *     provider.module,
 *     `search:${provider.id}`,
 *     async () => {
 *       const mod = await provider.loader();
 *       return mod.default(q);
 *     },
 *     [],
 *   );
 */
export async function safeCall<T>(
    moduleName: string,
    opName: string,
    fn: () => Promise<T> | T,
    fallback: T
): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        console.error(`[module-sandbox] ${moduleName}:${opName} failed:`, err);
        try {
            const { prisma } = await import("@/core/lib/db");
            await prisma.activityLog
                .create({
                    data: {
                        userId: null,
                        action: "module.runtime.error",
                        entity: "module",
                        entityId: moduleName,
                        metadata: {
                            operation: opName,
                            error: err instanceof Error ? err.message : String(err),
                            stack:
                                err instanceof Error
                                    ? err.stack?.split("\n").slice(0, 5).join("\n")
                                    : undefined,
                        },
                    },
                })
                .catch(() => {});
        } catch {
            /* logging is best-effort; never let the sandbox throw */
        }
        return fallback;
    }
}
