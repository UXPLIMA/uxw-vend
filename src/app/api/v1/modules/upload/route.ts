import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const MODULES_DIR = path.join(process.cwd(), "src/modules");

export async function POST(request: NextRequest) {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        // 2. Get form data with ZIP file
        const formData = await request.formData();
        const file = formData.get("file") as File;
        if (!file || !file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "Please upload a .zip file" }, { status: 400 });
        }

        // 3. Write ZIP to temp
        const buffer = Buffer.from(await file.arrayBuffer());
        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        const zipPath = path.join(tmpDir, `module-${Date.now()}.zip`);
        await fs.writeFile(zipPath, buffer);

        // 4. Extract to temp directory
        const extractDir = path.join(tmpDir, `module-extract-${Date.now()}`);
        await fs.mkdir(extractDir, { recursive: true });
        execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { timeout: 30000 });

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
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "No module.json found in ZIP" }, { status: 400 });
        }

        // 6. Parse and validate manifest
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        let manifest;
        try {
            manifest = JSON.parse(manifestRaw);
        } catch {
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Invalid module.json — not valid JSON" }, { status: 400 });
        }

        if (!manifest.id || !manifest.name || !manifest.version) {
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "module.json must have id, name, and version fields" }, { status: 400 });
        }

        // Validate id format (alphanumeric + hyphens only)
        if (!/^[a-z0-9-]+$/.test(manifest.id)) {
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Module ID must contain only lowercase letters, numbers, and hyphens" }, { status: 400 });
        }

        // 7. Check if module already exists
        const targetDir = path.join(MODULES_DIR, manifest.id);
        const exists = await fs.access(targetDir).then(() => true).catch(() => false);

        // 8. Copy module files to src/modules/[id]/
        if (exists) {
            // Remove old version
            await fs.rm(targetDir, { recursive: true, force: true });
        }

        // Copy from manifestDir to target
        execSync(`cp -r "${manifestDir}" "${targetDir}"`, { timeout: 10000 });

        // 9. Regenerate registry
        try {
            execSync("npx tsx scripts/generate-registry.ts", {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (err: unknown) {
            // Rollback: remove the module directory
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(extractDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
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
        await fs.rm(zipPath, { force: true });

        return NextResponse.json({
            message: "Module installed successfully",
            module: { id: manifest.id, name: manifest.name, version: manifest.version, enabled: false },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "Upload failed: " + message }, { status: 500 });
    }
}
