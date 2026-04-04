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

        // Cleanup
        await fs.rm(zipPath, { force: true });

        return NextResponse.json({
            message: "Module installed and enabled",
            module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true },
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: "Install failed: " + ((err instanceof Error ? err.message : "Unknown error")) }, { status: 500 });
    }
}
