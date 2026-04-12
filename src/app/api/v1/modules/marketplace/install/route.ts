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

        // Extract to module directory
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

        // Verify module.json exists
        const manifestPath = path.join(targetDir, "module.json");
        const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!hasManifest) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module — no module.json found" }, { status: 400 });
        }

        // Verify manifest.id matches requested moduleId
        const manifestData = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
        if (manifestData.id !== moduleId) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: `Manifest ID '${manifestData.id}' does not match requested module '${moduleId}'` }, { status: 400 });
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
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestRaw);
        await prisma.moduleConfig.upsert({
            where: { id: moduleId },
            update: { name: manifest.name, enabled: true },
            create: { id: moduleId, name: manifest.name, enabled: true },
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

// --- Translation merge helpers ---

const PROTECTED_KEYS = ["common", "nav", "auth", "hero", "footer", "errors", "metadata", "admin"];

function sanitizeTranslations(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = value.replace(/<[^>]*>/g, '');
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeTranslations(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result;
}

function safeMerge(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
    const sanitized = sanitizeTranslations(incoming);
    for (const key of PROTECTED_KEYS) delete sanitized[key];
    return { ...existing, ...sanitized };
}

async function mergeModuleTranslations(manifest: Record<string, unknown>, targetDir: string) {
    const messagesDir = path.join(process.cwd(), "messages");

    // From manifest translations field
    if (manifest.translations && typeof manifest.translations === 'object') {
        for (const [locale, translations] of Object.entries(manifest.translations as Record<string, unknown>)) {
            const msgPath = path.join(messagesDir, `${locale}.json`);
            try {
                const existing = JSON.parse(await fs.readFile(msgPath, "utf-8"));
                await fs.writeFile(msgPath, JSON.stringify(safeMerge(existing, translations as Record<string, unknown>), null, 2));
            } catch { /* skip */ }
        }
    }

    // From messages/ directory
    const moduleMessagesDir = path.join(targetDir, "messages");
    const hasDir = await fs.access(moduleMessagesDir).then(() => true).catch(() => false);
    if (hasDir) {
        const files = await fs.readdir(moduleMessagesDir);
        for (const file of files) {
            if (!file.endsWith(".json")) continue;
            try {
                const moduleTranslations = JSON.parse(await fs.readFile(path.join(moduleMessagesDir, file), "utf-8"));
                const corePath = path.join(messagesDir, file);
                const existing = JSON.parse(await fs.readFile(corePath, "utf-8"));
                await fs.writeFile(corePath, JSON.stringify(safeMerge(existing, moduleTranslations), null, 2));
            } catch { /* skip */ }
        }
    }
}
