import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace";

// POST /api/v1/modules/marketplace/install — Install a module from marketplace
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { moduleId, zipFile } = await request.json();
        if (!moduleId || !zipFile) {
            return NextResponse.json({ error: "moduleId and zipFile required" }, { status: 400 });
        }

        // Check if already installed
        const targetDir = path.join(MODULES_DIR, moduleId);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (exists) {
            return NextResponse.json({ error: "Module already installed" }, { status: 409 });
        }

        // Download ZIP from GitHub
        const zipUrl = `${MARKETPLACE_BASE}/${zipFile}`;
        const res = await fetch(zipUrl);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to download module: HTTP ${res.status}` }, { status: 502 });
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        // Write to temp
        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        const zipPath = path.join(tmpDir, `marketplace-${moduleId}-${Date.now()}.zip`);
        await fs.writeFile(zipPath, buffer);

        // Extract directly to module directory
        await fs.mkdir(targetDir, { recursive: true });
        execSync(`unzip -o "${zipPath}" -d "${targetDir}"`, { timeout: 30000 });

        // Verify module.json exists
        const manifestPath = path.join(targetDir, "module.json");
        const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!hasManifest) {
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Invalid module — no module.json found" }, { status: 400 });
        }

        // Regenerate registry
        try {
            execSync("npx tsx scripts/generate-registry.ts", {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (err: unknown) {
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Registry generation failed: " + String((err as Error)?.message || err).slice(0, 200) }, { status: 400 });
        }

        // Create DB record (enabled by default for marketplace installs)
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestRaw);
        await prisma.moduleConfig.upsert({
            where: { id: moduleId },
            update: { name: manifest.name, enabled: true },
            create: { id: moduleId, name: manifest.name, enabled: true },
        });

        // Run seed if manifest says to
        let seeded = false;
        if (manifest.seedOnInstall) {
            const seedPath = path.join(targetDir, "seed.ts");
            const hasSeed = await fs.access(seedPath).then(() => true).catch(() => false);
            if (hasSeed) {
                try {
                    execSync(`npx tsx "${seedPath}"`, {
                        cwd: process.cwd(),
                        timeout: 60000,
                        stdio: "pipe",
                    });
                    seeded = true;
                } catch (seedErr: unknown) {
                    // Seed failure is non-fatal — module is still installed
                    console.error(`[module-install] Seed failed for ${moduleId}:`, (seedErr as Error)?.message || seedErr);
                }
            }
        }

        // Merge module translations into core messages
        if (manifest.translations) {
            const messagesDir = path.join(process.cwd(), "messages");
            for (const [locale, translations] of Object.entries(manifest.translations)) {
                const msgPath = path.join(messagesDir, `${locale}.json`);
                try {
                    const existing = JSON.parse(await fs.readFile(msgPath, "utf-8"));
                    const merged = { ...existing, ...(translations as Record<string, unknown>) };
                    await fs.writeFile(msgPath, JSON.stringify(merged, null, 2));
                } catch { /* locale file doesn't exist, skip */ }
            }
        }

        // Also check for messages/ directory in module (alternative to manifest translations)
        const moduleMessagesDir = path.join(targetDir, "messages");
        const hasModuleMessages = await fs.access(moduleMessagesDir).then(() => true).catch(() => false);
        if (hasModuleMessages) {
            const localeFiles = await fs.readdir(moduleMessagesDir);
            const coreMessagesDir = path.join(process.cwd(), "messages");
            for (const file of localeFiles) {
                if (!file.endsWith(".json")) continue;
                try {
                    const moduleTranslations = JSON.parse(await fs.readFile(path.join(moduleMessagesDir, file), "utf-8"));
                    const corePath = path.join(coreMessagesDir, file);
                    const existing = JSON.parse(await fs.readFile(corePath, "utf-8"));
                    const merged = { ...existing, ...moduleTranslations };
                    await fs.writeFile(corePath, JSON.stringify(merged, null, 2));
                } catch { /* skip */ }
            }
        }

        // Cleanup
        await fs.rm(zipPath, { force: true });

        return NextResponse.json({
            message: seeded ? "Module installed, enabled, and seeded" : "Module installed and enabled",
            module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true, seeded },
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: "Install failed: " + ((err instanceof Error ? err.message : "Unknown error")) }, { status: 500 });
    }
}
