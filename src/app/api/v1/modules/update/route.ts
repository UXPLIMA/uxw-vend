import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";
import { moduleManifestSchema, collectManifestFileRefs } from "@/core/lib/module-manifest-schema";
import { validateZipEntries } from "@/core/lib/module-zip-validator";
import { backupBeforeModuleChange } from "@/core/lib/module-backup";
import { manifestHash } from "@/core/lib/module-install-audit";
import { MODULES_DIR, TMP_DIR, PROJECT_ROOT } from "@/core/lib/runtime-paths";

const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace";
const MAX_MODULE_SIZE = 50 * 1024 * 1024;

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

        if (!/^[a-z0-9-]+$/.test(moduleId)) {
            return NextResponse.json({ error: "Invalid module ID" }, { status: 400 });
        }
        if (!/^[a-z0-9-]+\.zip$/.test(zipFile)) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        const targetDir = path.join(MODULES_DIR, moduleId);
        const targetRoot = path.resolve(targetDir);
        if (!targetRoot.startsWith(path.resolve(MODULES_DIR) + path.sep)) {
            return NextResponse.json({ error: "Invalid module target path" }, { status: 400 });
        }

        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (!exists) {
            return NextResponse.json({ error: "Module not installed — use install instead" }, { status: 404 });
        }

        // Opt-in pre-update DB snapshot (MODULE_INSTALL_BACKUP=1). Module
        // updates can ship schema changes; a snapshot gives ops a point
        // to roll back to when a migration half-applies.
        await backupBeforeModuleChange("update", moduleId);

        const zipUrl = `${MARKETPLACE_BASE}/${zipFile}`;
        const res = await fetch(zipUrl);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to download module: HTTP ${res.status}` }, { status: 502 });
        }

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_MODULE_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_MODULE_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
        }

        let zip: AdmZip;
        let entries: AdmZip.IZipEntry[];
        try {
            zip = new AdmZip(buffer);
            entries = zip.getEntries();
        } catch {
            return NextResponse.json({ error: "Invalid or corrupt ZIP" }, { status: 400 });
        }

        const contentCheck = validateZipEntries(entries);
        if (!contentCheck.ok) {
            return NextResponse.json({ error: contentCheck.error ?? "ZIP validation failed" }, { status: 400 });
        }

        // Stage the update in a temp dir first, validate, then swap.
        const tmpDir = TMP_DIR;
        await fs.mkdir(tmpDir, { recursive: true });
        const stageDir = path.join(tmpDir, `module-stage-${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await fs.mkdir(stageDir, { recursive: true });
        const stageRoot = path.resolve(stageDir);

        const backupDir = path.join(tmpDir, `backup-${moduleId}-${Date.now()}`);

        try {
            for (const entry of entries) {
                if (entry.isDirectory) continue;
                const resolvedPath = path.resolve(stageDir, entry.entryName);
                if (!resolvedPath.startsWith(stageRoot + path.sep)) continue;
                await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
                await fs.writeFile(resolvedPath, entry.getData());
            }

            const manifestPath = path.join(stageDir, "module.json");
            const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
            if (!hasManifest) {
                return NextResponse.json({ error: "Invalid module update — no module.json found" }, { status: 400 });
            }

            let manifestJson: unknown;
            try {
                manifestJson = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
            } catch {
                return NextResponse.json({ error: "Invalid module.json — not valid JSON" }, { status: 400 });
            }

            const parsed = moduleManifestSchema.safeParse(manifestJson);
            if (!parsed.success) {
                const first = parsed.error.issues[0];
                const where = first.path.join(".");
                return NextResponse.json(
                    { error: `Invalid module.json: ${where ? where + " — " : ""}${first.message}` },
                    { status: 400 },
                );
            }
            const manifest = parsed.data;

            if (manifest.id !== moduleId) {
                return NextResponse.json(
                    { error: `Manifest ID '${manifest.id}' does not match requested module '${moduleId}'` },
                    { status: 400 },
                );
            }

            const missingRefs: string[] = [];
            for (const ref of collectManifestFileRefs(manifest)) {
                const cleaned = ref.replace(/^\.\//, "");
                const refPath = path.resolve(stageDir, cleaned);
                if (!refPath.startsWith(stageRoot + path.sep)) {
                    return NextResponse.json(
                        { error: `Manifest references escape module root: ${ref}` },
                        { status: 400 },
                    );
                }
                const refExists = await fs.access(refPath).then(() => true).catch(() => false);
                if (!refExists) missingRefs.push(ref);
            }
            if (missingRefs.length > 0) {
                return NextResponse.json(
                    { error: `Manifest references missing files: ${missingRefs.slice(0, 5).join(", ")}` },
                    { status: 400 },
                );
            }

            // Stage looks clean — back up current, swap in new
            await fs.cp(targetDir, backupDir, { recursive: true });
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.cp(stageDir, targetDir, { recursive: true });

            try {
                execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                    cwd: PROJECT_ROOT,
                    timeout: 30000,
                    stdio: "pipe",
                });
            } catch (regErr: unknown) {
                // Registry failed — restore backup and re-run registry with old version
                await fs.rm(targetDir, { recursive: true, force: true });
                await fs.cp(backupDir, targetDir, { recursive: true });
                try {
                    execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: PROJECT_ROOT, timeout: 30000, stdio: "pipe" });
                } catch { /* best effort */ }
                return NextResponse.json({
                    error: "Registry generation failed: " + String((regErr as Error)?.message || regErr).slice(0, 200),
                }, { status: 400 });
            }

            if (!process.env.NEXT_DEV) {
                try {
                    execFileSync("npm", ["run", "build"], { cwd: PROJECT_ROOT, timeout: 180000, stdio: "pipe" });
                    try { execFileSync("npx", ["pm2", "restart", "uxwvend"], { cwd: PROJECT_ROOT, timeout: 10000, stdio: "pipe" }); }
                    catch { process.kill(process.pid, "SIGUSR2"); }
                } catch { /* will work after manual restart */ }
            }

            const installedAt = new Date();
            const hash = manifestHash(manifest);
            await prisma.moduleConfig.upsert({
                where: { id: moduleId },
                update: {
                    name: manifest.name,
                    enabled: true,
                    manifestHash: hash,
                    installedAt,
                    installedByUserId: session.user.id,
                },
                create: {
                    id: moduleId,
                    name: manifest.name,
                    enabled: true,
                    manifestHash: hash,
                    installedAt,
                    installedByUserId: session.user.id,
                },
            });

            return NextResponse.json({
                message: "Module updated successfully",
                module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true },
            });
        } finally {
            await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
            await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
        }
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
