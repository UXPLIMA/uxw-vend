import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";
import { invalidateModuleCache } from "@/core/lib/module-cache";
import { acquireInstallLock } from "@/core/lib/install-lock";
import { incrementIndexDownloads } from "../_index-writer";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace";
const MAX_MODULE_SIZE = 50 * 1024 * 1024;

interface BulkResult {
    id: string;
    name: string;
    status: "installed" | "failed" | "skipped";
    error?: string;
}

/**
 * POST /api/v1/modules/marketplace/bulk-install
 * Install multiple modules in one request.
 * Runs schema merge, registry gen, build, and restart ONCE at the end.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const releaseLock = await acquireInstallLock();
    if (!releaseLock) {
        return NextResponse.json({ error: "Another install is in progress. Please try again." }, { status: 429 });
    }

    try {
    const { modules } = await request.json();
    if (!Array.isArray(modules) || modules.length === 0) {
        return NextResponse.json({ error: "modules array required" }, { status: 400 });
    }

    if (modules.length > 50) {
        return NextResponse.json({ error: "Max 50 modules per bulk install" }, { status: 400 });
    }

    const results: BulkResult[] = [];
    let hasSchemaChanges = false;

    // Phase 1: Download and extract all modules
    for (const mod of modules) {
        const { id, zip, name } = mod;
        if (!id || !zip) { results.push({ id: id || "unknown", name: name || id, status: "failed", error: "Missing id or zip" }); continue; }
        if (!/^[a-z0-9-]+\.zip$/.test(zip)) { results.push({ id, name: name || id, status: "failed", error: "Invalid zip name" }); continue; }
        if (!/^[a-z0-9-]+$/.test(id)) { results.push({ id, name: name || id, status: "failed", error: "Invalid module ID" }); continue; }

        const targetDir = path.join(MODULES_DIR, id);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (exists) { results.push({ id, name: name || id, status: "skipped", error: "Already installed" }); continue; }

        try {
            const res = await fetch(`${MARKETPLACE_BASE}/${zip}`);
            if (!res.ok) { results.push({ id, name: name || id, status: "failed", error: `Download failed: ${res.status}` }); continue; }

            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > MAX_MODULE_SIZE) { results.push({ id, name: name || id, status: "failed", error: "Too large" }); continue; }
            if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) { results.push({ id, name: name || id, status: "failed", error: "Invalid ZIP" }); continue; }

            await fs.mkdir(targetDir, { recursive: true });
            const zipFile = new AdmZip(buffer);
            for (const entry of zipFile.getEntries()) {
                if (entry.isDirectory || entry.entryName.includes("../")) continue;
                const resolvedPath = path.resolve(targetDir, entry.entryName);
                if (!resolvedPath.startsWith(path.resolve(targetDir) + path.sep)) continue;
                await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
                await fs.writeFile(resolvedPath, entry.getData());
            }

            // Verify module.json
            const manifestPath = path.join(targetDir, "module.json");
            const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
            if (!hasManifest) {
                await fs.rm(targetDir, { recursive: true, force: true });
                results.push({ id, name: name || id, status: "failed", error: "No module.json" });
                continue;
            }

            const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
            const hasSchema = await fs.access(path.join(targetDir, "schema.prisma")).then(() => true).catch(() => false);
            if (hasSchema) hasSchemaChanges = true;

            // Merge translations immediately (lightweight)
            await mergeTranslations(manifest, targetDir);

            // Create DB record
            await prisma.moduleConfig.upsert({
                where: { id },
                update: { name: manifest.name, enabled: true },
                create: { id, name: manifest.name, enabled: true },
            });

            // Track as marketplace install — drives the downloads counter.
            try {
                await prisma.moduleInstallEvent.create({
                    data: {
                        moduleId: id,
                        version: String(manifest.version ?? "unknown"),
                        installedById: session.user.id,
                    },
                });
            } catch { /* non-fatal */ }
            incrementIndexDownloads(id).catch(() => { /* non-fatal */ });

            results.push({ id, name: manifest.name, status: "installed" });
        } catch (err) {
            await fs.rm(path.join(MODULES_DIR, id), { recursive: true, force: true }).catch(() => {});
            results.push({ id, name: name || id, status: "failed", error: (err as Error).message.slice(0, 100) });
        }
    }

    // Phase 2: Single schema merge + registry gen + build + restart
    const installed = results.filter(r => r.status === "installed");
    if (installed.length > 0) {
        await invalidateModuleCache();

        // Schema merge + DB push
        if (hasSchemaChanges) {
            try {
                execFileSync("npx", ["tsx", "scripts/merge-schemas.ts"], { cwd: process.cwd(), timeout: 60000, stdio: "pipe" });
                execFileSync("npx", ["prisma", "db", "push"], { cwd: process.cwd(), timeout: 60000, stdio: "pipe" });
            } catch { /* will need manual: npm run db:merge && npm run db:push */ }
        }

        // Registry generation
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
        } catch { /* will need manual: npx tsx scripts/generate-registry.ts */ }

        // Single build + restart
        if (!process.env.NEXT_DEV) {
            try {
                execFileSync("npm", ["run", "build"], { cwd: process.cwd(), timeout: 300000, stdio: "pipe" });
                try { execFileSync("npx", ["pm2", "restart", "uxwvend"], { cwd: process.cwd(), timeout: 10000, stdio: "pipe" }); }
                catch { /* no PM2 */ }
            } catch { /* build failed — manual rebuild needed */ }
        }
    }

    return NextResponse.json({
        total: modules.length,
        installed: installed.length,
        failed: results.filter(r => r.status === "failed").length,
        skipped: results.filter(r => r.status === "skipped").length,
        results,
    });
    } finally {
        releaseLock();
    }
}

// --- Translation helpers (same as single install) ---
const PROTECTED_KEYS = ["common", "nav", "auth", "hero", "footer", "errors", "metadata", "admin"];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') result[key] = value.replace(/<[^>]*>/g, '');
        else if (typeof value === 'object' && value !== null) result[key] = sanitize(value as Record<string, unknown>);
        else result[key] = value;
    }
    return result;
}

async function mergeTranslations(manifest: Record<string, unknown>, targetDir: string) {
    const messagesDir = path.join(process.cwd(), "messages");
    if (manifest.translations && typeof manifest.translations === 'object') {
        for (const [locale, translations] of Object.entries(manifest.translations as Record<string, unknown>)) {
            const msgPath = path.join(messagesDir, `${locale}.json`);
            try {
                const existing = JSON.parse(await fs.readFile(msgPath, "utf-8"));
                const sanitized = sanitize(translations as Record<string, unknown>);
                for (const key of PROTECTED_KEYS) delete sanitized[key];
                await fs.writeFile(msgPath, JSON.stringify({ ...existing, ...sanitized }, null, 2));
            } catch { /* skip */ }
        }
    }
    const moduleMessagesDir = path.join(targetDir, "messages");
    const hasDir = await fs.access(moduleMessagesDir).then(() => true).catch(() => false);
    if (hasDir) {
        for (const file of await fs.readdir(moduleMessagesDir)) {
            if (!file.endsWith(".json")) continue;
            try {
                const modT = JSON.parse(await fs.readFile(path.join(moduleMessagesDir, file), "utf-8"));
                const corePath = path.join(messagesDir, file);
                const existing = JSON.parse(await fs.readFile(corePath, "utf-8"));
                const sanitized = sanitize(modT);
                for (const key of PROTECTED_KEYS) delete sanitized[key];
                await fs.writeFile(corePath, JSON.stringify({ ...existing, ...sanitized }, null, 2));
            } catch { /* skip */ }
        }
    }
}
