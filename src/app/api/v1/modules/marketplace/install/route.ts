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

        // Validate zipFile to prevent SSRF / path traversal
        if (!/^[a-z0-9-]+\.zip$/.test(zipFile)) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        // Block reserved module IDs
        const RESERVED_IDS = ["auth", "admin", "core", "api", "users", "roles", "settings", "profile", "modules", "themes"];
        if (RESERVED_IDS.includes(moduleId)) {
            return NextResponse.json({ error: "Module ID is reserved" }, { status: 400 });
        }

        // Check if already installed
        const targetDir = path.join(MODULES_DIR, moduleId);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);
        if (exists) {
            return NextResponse.json({ error: "Module already installed" }, { status: 409 });
        }

        // Download ZIP from GitHub with size limit
        const zipUrl = `${MARKETPLACE_BASE}/${zipFile}`;
        const res = await fetch(zipUrl);
        if (!res.ok) {
            return NextResponse.json({ error: `Failed to download module: HTTP ${res.status}` }, { status: 502 });
        }

        const contentLength = res.headers.get("content-length");
        const MAX_MODULE_SIZE = 50 * 1024 * 1024; // 50MB
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

        // Extract directly to module directory using adm-zip (no shell, path traversal protected)
        await fs.mkdir(targetDir, { recursive: true });
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            if (entry.entryName.includes("..")) continue;
            const resolvedPath = path.resolve(targetDir, entry.entryName);
            if (!resolvedPath.startsWith(path.resolve(targetDir) + path.sep)) continue;
            const dir = path.dirname(resolvedPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(resolvedPath, entry.getData());
        }

        // Verify module.json exists
        const manifestPath = path.join(targetDir, "module.json");
        const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!hasManifest) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module — no module.json found" }, { status: 400 });
        }

        // Regenerate registry
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (err: unknown) {
            await fs.rm(targetDir, { recursive: true, force: true });
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

        // Seed scripts must be run manually by admin for security
        // manifest.seedOnInstall is preserved in module.json but not auto-executed

        // Merge module translations into core messages
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

        function safeMergeTranslations(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
            const sanitized = sanitizeTranslations(incoming);
            for (const key of PROTECTED_KEYS) {
                delete sanitized[key];
            }
            return { ...existing, ...sanitized };
        }

        if (manifest.translations) {
            const messagesDir = path.join(process.cwd(), "messages");
            for (const [locale, translations] of Object.entries(manifest.translations)) {
                const msgPath = path.join(messagesDir, `${locale}.json`);
                try {
                    const existing = JSON.parse(await fs.readFile(msgPath, "utf-8"));
                    const merged = safeMergeTranslations(existing, translations as Record<string, unknown>);
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
                    const merged = safeMergeTranslations(existing, moduleTranslations);
                    await fs.writeFile(corePath, JSON.stringify(merged, null, 2));
                } catch { /* skip */ }
            }
        }

        return NextResponse.json({
            message: "Module installed and enabled",
            module: { id: moduleId, name: manifest.name, version: manifest.version, enabled: true },
        });
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
