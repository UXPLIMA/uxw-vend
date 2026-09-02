import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";
import prisma from "@/core/lib/db";
import { markSetupComplete } from "@/core/lib/setup-state";
import { invalidateModuleCache } from "@/core/lib/module-cache";
import { devOnlyDetail } from "@/core/lib/api-utils";
import {
    resolveInstallPlan,
    installPlanErrorMessage,
    type CatalogEntry,
} from "@/core/lib/module-dependencies";
import { MODULES_DIR } from "@/core/lib/runtime-paths";

/**
 * First-run setup API.
 *
 * Accepts a single POST payload containing the admin credentials, basic site
 * configuration, the selected theme, and any initial modules the installer
 * would like to enable. Every call re-verifies that `prisma.user.count() === 0`
 * so the endpoint cannot be replayed to create a second privileged account.
 */

const setupSchema = z.object({
    admin: z.object({
        email: z.string().email(),
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
        password: z.string().min(8).max(128),
    }),
    site: z.object({
        siteName: z.string().min(1).max(100),
        siteDescription: z.string().max(500).optional().default(""),
        defaultLocale: z.string().min(2).max(5),
    }),
    theme: z.string().min(1).max(50),
    // 50, not 20: the largest preset plus manual additions plus everything
    // those pull in transitively can exceed the old cap, and silently dropping
    // the tail produced a half-installed site.
    modules: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50).default([]),
});

const MARKETPLACE_DIR = path.join(process.cwd(), "module-marketplace");
const MAX_MODULE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
    // Early rejection: if anyone already exists, reply without reading the
    // body. This is a fast path only — the real race protection is the
    // advisory-locked transaction below.
    let existingUsers = 0;
    try {
        existingUsers = await prisma.user.count();
    } catch (err) {
        return NextResponse.json(
            { error: "Database unreachable", details: devOnlyDetail(err) },
            { status: 500 }
        );
    }

    if (existingUsers > 0) {
        markSetupComplete();
        return NextResponse.json(
            { error: "Setup has already been completed." },
            { status: 409 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", issues: parsed.error.issues },
            { status: 400 }
        );
    }
    const data = parsed.data;

    // Hash the password outside the transaction — bcrypt is CPU-heavy and
    // the advisory-locked transaction below should hold the lock for as
    // little time as possible.
    const hashed = await bcrypt.hash(data.admin.password, 12);

    // Stable integer key for pg_advisory_xact_lock. Any constant works as
    // long as nothing else in the app uses it for another purpose.
    const SETUP_LOCK_KEY = 738292847;

    let adminUser;
    let adminRoleId: string;
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Block any concurrent setup attempt on the same Postgres cluster
            // until this transaction commits or rolls back. The lock is
            // released automatically at transaction end.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;

            // Re-check inside the lock. Two requests that raced past the
            // early-path check outside both serialize here; the second one
            // sees count > 0 and aborts.
            const count = await tx.user.count();
            if (count > 0) {
                throw new Error("ALREADY_SETUP");
            }

            const adminRole = await tx.role.upsert({
                where: { name: "admin" },
                update: {},
                create: {
                    name: "admin",
                    displayName: "Administrator",
                    color: "#ef4444",
                    priority: 100,
                },
            });

            await tx.role.upsert({
                where: { name: "member" },
                update: {},
                create: {
                    name: "member",
                    displayName: "Member",
                    color: "#6b7280",
                    priority: 0,
                    isDefault: true,
                },
            });

            const admin = await tx.user.create({
                data: {
                    email: data.admin.email,
                    username: data.admin.username,
                    password: hashed,
                    roleId: adminRole.id,
                    emailVerified: new Date(),
                },
            });

            return { admin, adminRoleId: adminRole.id };
        });
        adminUser = result.admin;
        adminRoleId = result.adminRoleId;
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_SETUP") {
            markSetupComplete();
            return NextResponse.json(
                { error: "Setup has already been completed." },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: "Setup failed", details: devOnlyDetail(err) },
            { status: 500 },
        );
    }
    void adminRoleId;

    try {
        // ---------- Persist core settings ----------
        const settings: Array<{ key: string; value: unknown }> = [
            { key: "site_name", value: data.site.siteName },
            { key: "site_description", value: data.site.siteDescription || "" },
            { key: "default_locale", value: data.site.defaultLocale },
            { key: "active_theme", value: data.theme },
        ];
        for (const s of settings) {
            await prisma.setting.upsert({
                where: { key: s.key },
                update: { value: s.value as object },
                create: { key: s.key, value: s.value as object, module: "core" },
            });
        }

        // ---------- Plan the install ----------
        // The previous implementation installed the selection verbatim, in
        // whatever order it arrived. Picking `wheel` without `credits`, or
        // `store` without `currency`, therefore produced a module whose
        // prerequisites were simply absent. Planning first turns that into
        // either a corrected install or a clear refusal.
        const installedModules: string[] = [];
        const failedModules: Array<{ id: string; reason: string }> = [];
        let autoAdded: string[] = [];
        let registryNeedsRegen = false;

        if (data.modules.length > 0) {
            const plan = resolveInstallPlan(data.modules, await loadCatalog());

            if (plan.errors.length > 0) {
                // Refuse the module set rather than install part of it. The
                // admin account and settings above are already committed, so
                // the operator can re-run just the module step from the admin
                // panel — a half-installed site is the worse outcome.
                markSetupComplete();
                return NextResponse.json(
                    {
                        error: "The selected modules cannot be installed together.",
                        issues: plan.errors.map((e) => ({ ...e, message: installPlanErrorMessage(e) })),
                        adminCreated: true,
                    },
                    { status: 400 },
                );
            }

            autoAdded = plan.autoAdded;

            // plan.order is topological: a module is never extracted before
            // something it depends on.
            for (const moduleId of plan.order) {
                try {
                    await installModuleFromLocalMarketplace(moduleId);
                    await prisma.moduleConfig.upsert({
                        where: { id: moduleId },
                        update: { enabled: true },
                        create: {
                            id: moduleId,
                            name: moduleId,
                            enabled: true,
                        },
                    });
                    const { doActionAsync, HookNames } = await import("@/core/lib/hooks");
                    await doActionAsync(HookNames.MODULE_INSTALLED, { moduleId });

                    installedModules.push(moduleId);
                    registryNeedsRegen = true;
                } catch (err) {
                    console.error(`[setup] Failed to install module "${moduleId}":`, err);
                    failedModules.push({
                        id: moduleId,
                        reason: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }

        if (registryNeedsRegen) {
            // Run the schema merge + registry regeneration best-effort. These
            // scripts are safe to re-run; failures don't break the setup flow.
            try {
                execFileSync("npx", ["tsx", "scripts/merge-schemas.ts"], {
                    cwd: process.cwd(),
                    timeout: 60000,
                    stdio: "pipe",
                });
                // Create the tables the merged schema declares. Only one of
                // the twenty-six modules that ship a schema.prisma also ships
                // a migrations/ directory — per docs/MIGRATIONS.md, migrations
                // cover changes *after* a module's initial release and `db
                // push` is what creates its tables the first time. Without
                // this, every module the wizard installs comes up enabled and
                // tableless: Prisma P2021 on its first request.
                execFileSync("npx", ["prisma", "db", "push"], {
                    cwd: process.cwd(),
                    timeout: 120000,
                    stdio: "pipe",
                });
            } catch (err) {
                // Non-fatal, but the operator needs to know: a failed merge
                // means the push above did not run, and a failed push means
                // the modules below have no tables.
                console.error("[setup] Schema merge/push failed:", err);
            }
            try {
                execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                    cwd: process.cwd(),
                    timeout: 60000,
                    stdio: "pipe",
                });
            } catch {
                /* non-fatal */
            }
            // Per-module SQL migrations. Setup never ran these, so a module
            // shipping migrations installed with none of its tables — the
            // module then failed at first use with a Prisma error rather than
            // anything the operator could act on.
            for (const moduleId of installedModules) {
                try {
                    execFileSync("npx", ["tsx", "scripts/apply-migrations.ts", `--module=${moduleId}`], {
                        cwd: process.cwd(),
                        timeout: 120000,
                        stdio: "pipe",
                    });
                } catch (err) {
                    console.error(`[setup] Migrations failed for "${moduleId}":`, err);
                    failedModules.push({ id: moduleId, reason: "migrations failed" });
                }
            }
        }

        await invalidateModuleCache().catch(() => {});

        // ---------- Activity log (best-effort) ----------
        try {
            await prisma.activityLog.create({
                data: {
                    userId: adminUser.id,
                    action: "setup.complete",
                    entity: "system",
                    entityId: null,
                    metadata: {
                        installedModules,
                        autoAdded,
                        failedModules,
                        theme: data.theme,
                    },
                },
            });
        } catch {
            /* non-fatal */
        }

        markSetupComplete();

        return NextResponse.json({
            success: true,
            redirectTo: "/admin",
            installedModules,
            // Dependencies the operator did not pick but that had to come
            // along. Surfaced so the wizard can say what it installed.
            autoAdded,
            failedModules,
        });
    } catch (err) {
        return NextResponse.json(
            { error: "Setup failed", details: devOnlyDetail(err) },
            { status: 500 },
        );
    }
}

/**
 * Reads the shipped marketplace catalog for dependency planning.
 *
 * Returns an empty catalog when the file is unreadable — `resolveInstallPlan`
 * then reports every requested module as unknown, which is the honest outcome:
 * without a catalog we cannot know what a module needs.
 */
async function loadCatalog(): Promise<CatalogEntry[]> {
    try {
        const raw = await fs.readFile(path.join(MARKETPLACE_DIR, "index.json"), "utf8");
        const parsed = JSON.parse(raw) as {
            modules?: Array<{
                id?: string;
                version?: string;
                dependencies?: string[];
                conflicts?: string[];
                coreVersion?: string | null;
            }>;
        };
        return (parsed.modules ?? [])
            .filter((m): m is { id: string; version?: string } & typeof m => typeof m.id === "string")
            .map((m) => ({
                id: m.id,
                version: m.version ?? "0.0.0",
                dependencies: m.dependencies ?? [],
                conflicts: m.conflicts ?? [],
                ...(m.coreVersion ? { coreVersion: m.coreVersion } : {}),
            }));
    } catch (err) {
        console.error("[setup] Could not read the marketplace catalog:", err);
        return [];
    }
}

/**
 * Extracts a marketplace ZIP that already ships with the platform into
 * `src/modules/[id]/`. Uses the same validation rules as the full marketplace
 * installer but skips the GitHub download since we're using local files.
 */
async function installModuleFromLocalMarketplace(moduleId: string): Promise<void> {
    if (!/^[a-z0-9-]+$/.test(moduleId)) {
        throw new Error("Invalid module id");
    }

    const zipPath = path.join(MARKETPLACE_DIR, `${moduleId}.zip`);
    const zipExists = await fs
        .access(zipPath)
        .then(() => true)
        .catch(() => false);
    if (!zipExists) {
        throw new Error(`Module ${moduleId} not present in marketplace`);
    }

    const targetDir = path.join(MODULES_DIR, moduleId);
    const targetExists = await fs
        .access(targetDir)
        .then(() => true)
        .catch(() => false);
    if (targetExists) {
        // Already extracted — nothing to do beyond enabling.
        return;
    }

    const buffer = await fs.readFile(zipPath);
    if (buffer.length > MAX_MODULE_SIZE) {
        throw new Error("Module ZIP too large");
    }
    if (
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b ||
        buffer[2] !== 0x03 ||
        buffer[3] !== 0x04
    ) {
        throw new Error("Invalid ZIP file");
    }

    await fs.mkdir(targetDir, { recursive: true });
    const zip = new AdmZip(buffer);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        if (entry.entryName.includes("../")) continue;
        const resolvedPath = path.resolve(targetDir, entry.entryName);
        if (!resolvedPath.startsWith(path.resolve(targetDir) + path.sep)) continue;
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, entry.getData());
    }

    const manifestPath = path.join(targetDir, "module.json");
    const hasManifest = await fs
        .access(manifestPath)
        .then(() => true)
        .catch(() => false);
    if (!hasManifest) {
        await fs.rm(targetDir, { recursive: true, force: true });
        throw new Error("Extracted module missing module.json");
    }
}
