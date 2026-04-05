import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace";

// POST /api/v1/modules/update — Update an installed module from marketplace
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { moduleId, zipFile } = await request.json();
        if (!moduleId || !zipFile) {
            return NextResponse.json({ error: "moduleId and zipFile required" }, { status: 400 });
        }

        // Verify module is already installed
        const targetDir = path.join(MODULES_DIR, moduleId);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (!exists) {
            return NextResponse.json({ error: "Module not installed — use install instead" }, { status: 404 });
        }

        // Download ZIP from GitHub
        const zipUrl = `${MARKETPLACE_BASE}/${zipFile}`;
        const res = await fetch(zipUrl);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to download module: HTTP ${res.status}` }, { status: 502 });
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        // Create backup of current module
        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        const backupDir = path.join(tmpDir, `backup-${moduleId}-${Date.now()}`);
        await fs.cp(targetDir, backupDir, { recursive: true });

        // Extract over existing directory using adm-zip (no shell, path traversal protected)
        try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            for (const entry of entries) {
                if (entry.isDirectory) continue;
                if (entry.entryName.includes("../")) continue;
                const resolvedPath = path.resolve(targetDir, entry.entryName);
                if (!resolvedPath.startsWith(path.resolve(targetDir) + path.sep)) continue;
                const dir = path.dirname(resolvedPath);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(resolvedPath, entry.getData());
            }
        } catch (extractErr: unknown) {
            // Restore backup on failure
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.cp(backupDir, targetDir, { recursive: true });
            await fs.rm(backupDir, { recursive: true, force: true });
            return NextResponse.json({
                error: "Extraction failed: " + String((extractErr as Error)?.message || extractErr).slice(0, 200),
            }, { status: 500 });
        }

        // Verify module.json still exists
        const manifestPath = path.join(targetDir, "module.json");
        const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!hasManifest) {
            // Restore backup
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.cp(backupDir, targetDir, { recursive: true });
            await fs.rm(backupDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module update — no module.json found" }, { status: 400 });
        }

        // Regenerate registry
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (regErr: unknown) {
            // Restore backup on registry failure
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.cp(backupDir, targetDir, { recursive: true });
            await fs.rm(backupDir, { recursive: true, force: true });
            // Re-generate registry with old module
            try {
                execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
            } catch { /* best effort */ }
            return NextResponse.json({
                error: "Registry generation failed: " + String((regErr as Error)?.message || regErr).slice(0, 200),
            }, { status: 400 });
        }

        // Rebuild + restart production
        if (!process.env.NEXT_DEV) {
            try {
                execFileSync("npm", ["run", "build"], { cwd: process.cwd(), timeout: 180000, stdio: "pipe" });
                try { execFileSync("npx", ["pm2", "restart", "uxwvend"], { cwd: process.cwd(), timeout: 10000, stdio: "pipe" }); }
                catch { process.kill(process.pid, "SIGUSR2"); }
            } catch { /* will work after manual restart */ }
        }

        // Update DB record
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestRaw);
        await prisma.moduleConfig.upsert({
            where: { id: moduleId },
            update: { name: manifest.name, enabled: true },
            create: { id: moduleId, name: manifest.name, enabled: true },
        });

        // Cleanup
        await fs.rm(backupDir, { recursive: true, force: true });

        return NextResponse.json({
            message: "Module updated successfully",
            module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true },
        });
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
