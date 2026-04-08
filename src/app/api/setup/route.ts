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
    modules: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).default([]),
});

const MARKETPLACE_DIR = path.join(process.cwd(), "module-marketplace");
const MODULES_DIR = path.join(process.cwd(), "src/modules");
const MAX_MODULE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
    // Re-verify fresh-install state on every request. This is the ONLY real
    // protection against setup-wizard replay attacks.
    let existingUsers = 0;
    try {
        existingUsers = await prisma.user.count();
    } catch (err) {
        return NextResponse.json(
            { error: "Database unreachable", details: err instanceof Error ? err.message : "unknown" },
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

    // Parse + validate payload.
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

    try {
        // ---------- Ensure the admin role exists ----------
        const adminRole = await prisma.role.upsert({
            where: { name: "admin" },
            update: {},
            create: {
                name: "admin",
                displayName: "Administrator",
                color: "#ef4444",
                priority: 100,
            },
        });

        // Default "member" role used by user registration later. Safe-create
        // here because a fresh DB may not have been seeded.
        await prisma.role.upsert({
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

        // ---------- Create the first admin user ----------
        const hashed = await bcrypt.hash(data.admin.password, 12);
        const adminUser = await prisma.user.create({
            data: {
                email: data.admin.email,
                username: data.admin.username,
                password: hashed,
                roleId: adminRole.id,
                emailVerified: new Date(),
            },
        });

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

        // ---------- Install requested modules from local marketplace ----------
        const installedModules: string[] = [];
        const failedModules: string[] = [];
        let registryNeedsRegen = false;

        for (const moduleId of data.modules) {
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
                installedModules.push(moduleId);
                registryNeedsRegen = true;
            } catch (err) {
                console.error(`[setup] Failed to install module "${moduleId}":`, err);
                failedModules.push(moduleId);
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
            } catch {
                /* non-fatal */
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
                    metadata: JSON.stringify({
                        installedModules,
                        failedModules,
                        theme: data.theme,
                    }),
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
            failedModules,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Setup failed";
        return NextResponse.json({ error: msg }, { status: 500 });
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
