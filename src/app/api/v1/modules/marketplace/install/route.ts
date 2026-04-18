import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";
import { invalidateModuleCache } from "@/core/lib/module-cache";
import { acquireInstallLock, scheduleBuild } from "@/core/lib/install-lock";
import { logActivity } from "@/core/lib/activity-log";
import { incrementIndexDownloads } from "../_index-writer";
import { moduleManifestSchema, collectManifestFileRefs } from "@/core/lib/module-manifest-schema";
import { validateZipEntries } from "@/core/lib/module-zip-validator";
import { backupBeforeModuleChange } from "@/core/lib/module-backup";
import { manifestHash } from "@/core/lib/module-install-audit";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace";
const MAX_MODULE_SIZE = 50 * 1024 * 1024; // 50MB
const RESERVED_IDS = ["auth", "admin", "core", "api", "users", "roles", "settings", "profile", "modules", "themes"];

// POST /api/v1/modules/marketplace/install — Install a module from marketplace
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const releaseLock = await acquireInstallLock();
    if (!releaseLock) {
        return NextResponse.json({ error: "Another install is in progress. Please try again." }, { status: 429 });
    }

    try {
        const { moduleId, zipFile } = await request.json();
        if (!moduleId || !zipFile) {
            return NextResponse.json({ error: "moduleId and zipFile required" }, { status: 400 });
        }

        // Validate zipFile to prevent SSRF / path traversal
        if (!/^[a-z0-9-]+\.zip$/.test(zipFile)) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        if (RESERVED_IDS.includes(moduleId)) {
            return NextResponse.json({ error: "Module ID is reserved" }, { status: 400 });
        }

        // Check if already installed
        const targetDir = path.join(MODULES_DIR, moduleId);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (exists) {
            return NextResponse.json({ error: "Module already installed" }, { status: 409 });
        }

        // Opt-in pre-install DB snapshot. Modules can ship schema.prisma
        // fragments that merge into the core schema, and a half-applied
        // migration is the single most common "why is production broken"
        // scenario. Snapshot fails silently when pg_dump isn't available
        // (dev boxes, minimal Docker images) — the install still proceeds.
        await backupBeforeModuleChange("install", moduleId);

        // Check available disk space (need at least 100MB free)
        try {
            const stats = await fs.statfs(MODULES_DIR);
            const freeBytes = stats.bsize * stats.bfree;
            if (freeBytes < 100 * 1024 * 1024) {
                return NextResponse.json({ error: "Insufficient disk space" }, { status: 507 });
            }
        } catch { /* statfs not available on all platforms */ }

        // Download ZIP from GitHub with size limit
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

        // Validate ZIP magic number
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
        }

        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        const contentCheck = validateZipEntries(entries);
        if (!contentCheck.ok) {
            return NextResponse.json({ error: contentCheck.error ?? "ZIP validation failed" }, { status: 400 });
        }

        // Extract to module directory
        await fs.mkdir(targetDir, { recursive: true });
        const targetRoot = path.resolve(targetDir);
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            const resolvedPath = path.resolve(targetDir, entry.entryName);
            if (!resolvedPath.startsWith(targetRoot + path.sep)) continue;
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, entry.getData());
        }

        // Verify module.json exists
        const manifestPath = path.join(targetDir, "module.json");
        const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!hasManifest) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module — no module.json found" }, { status: 400 });
        }

        // Parse + validate manifest with Zod
        let manifestJson: unknown;
        try {
            manifestJson = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
        } catch {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module.json — not valid JSON" }, { status: 400 });
        }

        const parsed = moduleManifestSchema.safeParse(manifestJson);
        if (!parsed.success) {
            await fs.rm(targetDir, { recursive: true, force: true });
            const first = parsed.error.issues[0];
            const where = first.path.join(".");
            return NextResponse.json(
                { error: `Invalid module.json: ${where ? where + " — " : ""}${first.message}` },
                { status: 400 },
            );
        }
        const manifestData = parsed.data;

        if (manifestData.id !== moduleId) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: `Manifest ID '${manifestData.id}' does not match requested module '${moduleId}'` }, { status: 400 });
        }

        const missingRefs: string[] = [];
        for (const ref of collectManifestFileRefs(manifestData)) {
            const cleaned = ref.replace(/^\.\//, "");
            const refPath = path.resolve(targetDir, cleaned);
            if (!refPath.startsWith(targetRoot + path.sep)) {
                await fs.rm(targetDir, { recursive: true, force: true });
                return NextResponse.json(
                    { error: `Manifest references escape module root: ${ref}` },
                    { status: 400 },
                );
            }
            const refExists = await fs.access(refPath).then(() => true).catch(() => false);
            if (!refExists) missingRefs.push(ref);
        }
        if (missingRefs.length > 0) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json(
                { error: `Manifest references missing files: ${missingRefs.slice(0, 5).join(", ")}` },
                { status: 400 },
            );
        }

        // Schema merge (sync, lightweight — just merges files)
        const schemaPath = path.join(targetDir, "schema.prisma");
        const hasSchema = await fs.access(schemaPath).then(() => true).catch(() => false);
        if (hasSchema) {
            try {
                execFileSync("npx", ["tsx", "scripts/merge-schemas.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
            } catch {
                // Non-fatal: schema will be merged during deferred build
            }
        }

        // Registry generation (sync, lightweight)
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
        } catch {
            // Non-fatal: registry will be regenerated during deferred build
        }

        // Create DB record
        const manifest = manifestData;
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
        await invalidateModuleCache();

        // Sync translations to DB (instant, no rebuild needed)
        if (manifest.translations) {
            const { syncModuleTranslations } = await import("@/core/lib/i18n/translation-service");
            await syncModuleTranslations(moduleId, manifest.translations);
        }

        // Schedule deferred build + restart (debounced — waits for more installs)
        // Bulk install: 37 modules call this, but only ONE build runs after all finish
        scheduleBuild();

        logActivity({
            userId: session.user.id,
            action: "module.install",
            entity: "module",
            entityId: moduleId,
            metadata: { name: manifest.name, version: manifest.version },
        }).catch(() => {});

        // Track the install as a marketplace download. Best-effort — we never
        // fail the install just because the counter couldn't be persisted.
        try {
            await prisma.moduleInstallEvent.create({
                data: {
                    moduleId,
                    version: String(manifest.version ?? "unknown"),
                    installedById: session.user.id,
                },
            });
        } catch { /* non-fatal */ }
        incrementIndexDownloads(moduleId).catch(() => { /* non-fatal */ });

        return NextResponse.json({
            message: "Module installed and enabled",
            module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true },
            buildScheduled: true,
        });
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        releaseLock();
    }
}

