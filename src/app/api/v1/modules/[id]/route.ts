import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import { logActivity } from "@/core/lib/activity-log";
import { acquireInstallLock } from "@/core/lib/install-lock";
import { invalidateModuleCache } from "@/core/lib/module-cache";
import { devOnlyDetail } from "@/core/lib/api-utils";
import { backupBeforeModuleChange } from "@/core/lib/module-backup";
import { MODULES_DIR, PROJECT_ROOT } from "@/core/lib/runtime-paths";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: moduleId } = await params;

    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!/^[a-z0-9-]+$/.test(moduleId)) {
        return NextResponse.json({ error: "Invalid module ID" }, { status: 400 });
    }

    // Serialize module mutations through the same lock install/update use so
    // a concurrent install of the same module can't race a delete.
    const releaseLock = await acquireInstallLock();
    if (!releaseLock) {
        return NextResponse.json(
            { error: "Another module operation is in progress. Please try again." },
            { status: 429 }
        );
    }

    try {
        const moduleDir = path.join(MODULES_DIR, moduleId);
        const resolvedDir = path.resolve(moduleDir);
        if (!resolvedDir.startsWith(path.resolve(MODULES_DIR) + path.sep)) {
            return NextResponse.json({ error: "Invalid module path" }, { status: 400 });
        }

        const exists = await fs.access(moduleDir).then(() => true).catch(() => false);
        if (!exists) {
            // Even with no directory, clean up orphan DB rows — a previous
            // failed install may have left a ModuleConfig row behind.
            await prisma.moduleConfig.deleteMany({ where: { id: moduleId } }).catch(() => {});
            await invalidateModuleCache().catch(() => {});
            return NextResponse.json({ error: "Module not found on disk" }, { status: 404 });
        }

        // Opt-in pre-uninstall snapshot (MODULE_INSTALL_BACKUP=1). Even
        // though we preserve module-owned tables for reinstall, the
        // registry regen + build may still brick runtime state on a bad
        // module — a snapshot buys the operator a clean rollback.
        await backupBeforeModuleChange("uninstall", moduleId);

        await fs.rm(moduleDir, { recursive: true, force: true });

        // Module-owned tables (e.g. Store products when "store" is uninstalled)
        // are intentionally preserved so a future reinstall of the same module
        // does not lose the admin's data. Operators who want a true purge can
        // drop the module's tables via the schema merge + migration tooling.

        try {
            const { removeModuleTranslations } = await import("@/core/lib/i18n/translation-service");
            await removeModuleTranslations(moduleId);
        } catch { /* non-fatal */ }

        // Remove the DB config row BEFORE registry regeneration so the app
        // can never observe a state where the registry lists the module but
        // ModuleConfig says it should be disabled.
        await prisma.moduleConfig.deleteMany({ where: { id: moduleId } });
        await invalidateModuleCache().catch(() => {});

        let registryNeedsRebuild = false;
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: PROJECT_ROOT, timeout: 30000, stdio: "pipe" });
            if (process.env.NODE_ENV === "production") {
                execFileSync("npm", ["run", "build"], { cwd: PROJECT_ROOT, timeout: 180000, stdio: "pipe" });
                try { execFileSync("npx", ["pm2", "restart", "uxwvend"], { cwd: PROJECT_ROOT, timeout: 10000, stdio: "pipe" }); }
                catch { process.kill(process.pid, "SIGUSR2"); }
            }
        } catch (err) {
            // Registry/build failure is non-fatal for uninstall — the module
            // files are already gone and the DB row is cleared. But the
            // generated registry may still reference the deleted module's
            // imports, which would brick the next build. Log loudly and
            // surface the warning so the operator knows to rebuild manually.
            registryNeedsRebuild = true;
            console.error("[module:uninstall] registry regeneration failed for", moduleId, err);
        }

        logActivity({
            action: "module.uninstall",
            entity: "module",
            entityId: moduleId,
            userId: session.user.id,
        }).catch(() => {});

        return NextResponse.json({
            message: "Module deleted successfully",
            ...(registryNeedsRebuild ? { warning: "Module files removed but registry regeneration failed — run `npm run build` to clean up generated imports." } : {}),
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Delete failed", details: devOnlyDetail(err) },
            { status: 500 },
        );
    } finally {
        releaseLock();
    }
}
