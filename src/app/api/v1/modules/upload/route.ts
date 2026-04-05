import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { rateLimit } from "@/core/lib/rate-limit";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";

const MODULES_DIR = path.join(process.cwd(), "src/modules");

export async function POST(request: NextRequest) {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Rate limit: 3 uploads per hour
    const rl = await rateLimit(`upload:${session.user.id}`, { maxRequests: 3, windowMs: 3600000 });
    if (!rl.success) {
        return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }

    try {
        // 2. Get form data with ZIP file
        const formData = await request.formData();
        const file = formData.get("file") as File;
        if (!file || !file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "Please upload a .zip file" }, { status: 400 });
        }

        // 3. Check file size (max 50MB)
        const MAX_MODULE_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_MODULE_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }

        // 4. Read ZIP buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate ZIP magic number
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
        }

        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });

        // 4. Extract to temp directory using adm-zip (no shell, path traversal protected)
        const extractDir = path.join(tmpDir, `module-extract-${Date.now()}`);
        await fs.mkdir(extractDir, { recursive: true });
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            if (entry.entryName.includes("../")) continue;
            const resolvedPath = path.resolve(extractDir, entry.entryName);
            if (!resolvedPath.startsWith(path.resolve(extractDir) + path.sep)) continue;
            const dir = path.dirname(resolvedPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(resolvedPath, entry.getData());
        }

        // 5. Find module.json (might be in root or in a subdirectory)
        let manifestDir = extractDir;
        const rootFiles = await fs.readdir(extractDir);

        if (!rootFiles.includes("module.json")) {
            // Check if there's a single subdirectory containing module.json
            const subdirs = [];
            for (const f of rootFiles) {
                const stat = await fs.stat(path.join(extractDir, f));
                if (stat.isDirectory()) subdirs.push(f);
            }
            if (subdirs.length === 1) {
                const subdir = path.join(extractDir, subdirs[0]);
                const subFiles = await fs.readdir(subdir);
                if (subFiles.includes("module.json")) {
                    manifestDir = subdir;
                }
            }
        }

        const manifestPath = path.join(manifestDir, "module.json");

        try {
            await fs.access(manifestPath);
        } catch {
            // Cleanup
            await fs.rm(extractDir, { recursive: true, force: true });
            return NextResponse.json({ error: "No module.json found in ZIP" }, { status: 400 });
        }

        // 6. Parse and validate manifest
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        let manifest;
        try {
            manifest = JSON.parse(manifestRaw);
        } catch {
            await fs.rm(extractDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid module.json — not valid JSON" }, { status: 400 });
        }

        if (!manifest.id || !manifest.name || !manifest.version) {
            await fs.rm(extractDir, { recursive: true, force: true });
            return NextResponse.json({ error: "module.json must have id, name, and version fields" }, { status: 400 });
        }

        // Validate id format (alphanumeric + hyphens only)
        if (!/^[a-z0-9-]+$/.test(manifest.id)) {
            await fs.rm(extractDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Module ID must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
        }

        // Block reserved module IDs
        const RESERVED_IDS = ["auth", "admin", "core", "api", "users", "roles", "settings", "profile", "modules", "themes"];
        if (RESERVED_IDS.includes(manifest.id)) {
            await fs.rm(extractDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Module ID is reserved" }, { status: 400 });
        }

        // 7. Check if module already exists
        const targetDir = path.join(MODULES_DIR, manifest.id);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);

        // 8. Copy module files to src/modules/[id]/
        if (exists) {
            // Remove old version
            await fs.rm(targetDir, { recursive: true, force: true });
        }

        // Copy from manifestDir to target (safe fs.cp, no shell)
        await fs.cp(manifestDir, targetDir, { recursive: true });

        // 9. Regenerate registry
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (err: unknown) {
            // Rollback: remove the module directory
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(extractDir, { recursive: true, force: true });
            const message = err instanceof Error ? err.message : "Unknown error";
            return NextResponse.json({ error: "Module has errors — registry generation failed: " + message }, { status: 400 });
        }

        // 10. Create DB record (disabled by default)
        await prisma.moduleConfig.upsert({
            where: { id: manifest.id },
            update: { name: manifest.name },
            create: { id: manifest.id, name: manifest.name, enabled: false },
        });

        // 11. Cleanup temp files
        await fs.rm(extractDir, { recursive: true, force: true });

        return NextResponse.json({
            message: "Module installed successfully",
            module: { id: manifest.id, name: manifest.name, version: manifest.version, enabled: false },
        });
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
