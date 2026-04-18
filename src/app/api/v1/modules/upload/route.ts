import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { rateLimit } from "@/core/lib/rate-limit";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";
import { acquireInstallLock } from "@/core/lib/install-lock";
import { moduleManifestSchema, collectManifestFileRefs } from "@/core/lib/module-manifest-schema";
import { validateZipEntries } from "@/core/lib/module-zip-validator";
import { backupBeforeModuleChange } from "@/core/lib/module-backup";
import { manifestHash } from "@/core/lib/module-install-audit";
import { checkModuleDependencies, dependencyErrorMessage } from "@/core/lib/module-dependencies";

const MODULES_DIR = path.join(process.cwd(), "src/modules");
const RESERVED_IDS = new Set([
    "auth", "admin", "core", "api", "users", "roles", "settings", "profile", "modules", "themes",
]);

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rl = await rateLimit(`upload:${session.user.id}`, { maxRequests: 3, windowMs: 3600000 });
    if (!rl.success) {
        return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }

    const releaseLock = await acquireInstallLock();
    if (!releaseLock) {
        return NextResponse.json({ error: "Another install is in progress. Please try again." }, { status: 429 });
    }

    let extractDir: string | null = null;
    let createdTargetDir: string | null = null;

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        if (!file || !file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "Please upload a .zip file" }, { status: 400 });
        }

        const MAX_MODULE_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_MODULE_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
        }

        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        const contentCheck = validateZipEntries(entries);
        if (!contentCheck.ok) {
            return NextResponse.json({ error: contentCheck.error ?? "ZIP validation failed" }, { status: 400 });
        }

        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        extractDir = path.join(tmpDir, `module-extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await fs.mkdir(extractDir, { recursive: true });

        const extractRoot = path.resolve(extractDir);
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            const resolvedPath = path.resolve(extractDir, entry.entryName);
            if (!resolvedPath.startsWith(extractRoot + path.sep)) continue;
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, entry.getData());
        }

        let manifestDir = extractDir;
        const rootFiles = await fs.readdir(extractDir);

        if (!rootFiles.includes("module.json")) {
            const subdirs: string[] = [];
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
            return NextResponse.json({ error: "No module.json found in ZIP" }, { status: 400 });
        }

        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        let manifestJson: unknown;
        try {
            manifestJson = JSON.parse(manifestRaw);
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

        if (RESERVED_IDS.has(manifest.id)) {
            return NextResponse.json({ error: "Module ID is reserved" }, { status: 400 });
        }

        const depCheck = await checkModuleDependencies(manifest);
        if (!depCheck.ok) {
            return NextResponse.json(
                {
                    error: `Module ${manifest.id} ${dependencyErrorMessage(depCheck)}`,
                    missingDependencies: depCheck.missingDependencies,
                    disabledDependencies: depCheck.disabledDependencies,
                    activeConflicts: depCheck.activeConflicts,
                },
                { status: 409 },
            );
        }

        const manifestRoot = path.resolve(manifestDir);
        const missingRefs: string[] = [];
        for (const ref of collectManifestFileRefs(manifest)) {
            const cleaned = ref.replace(/^\.\//, "");
            const refPath = path.resolve(manifestDir, cleaned);
            if (!refPath.startsWith(manifestRoot + path.sep)) {
                return NextResponse.json(
                    { error: `Manifest references escape module root: ${ref}` },
                    { status: 400 },
                );
            }
            const exists = await fs.access(refPath).then(() => true).catch(() => false);
            if (!exists) missingRefs.push(ref);
        }
        if (missingRefs.length > 0) {
            return NextResponse.json(
                { error: `Manifest references missing files: ${missingRefs.slice(0, 5).join(", ")}` },
                { status: 400 },
            );
        }

        const targetDir = path.join(MODULES_DIR, manifest.id);
        const targetResolved = path.resolve(targetDir);
        if (!targetResolved.startsWith(path.resolve(MODULES_DIR) + path.sep)) {
            return NextResponse.json({ error: "Invalid module target path" }, { status: 400 });
        }

        const exists = await fs.access(targetDir).then(() => true).catch(() => false);

        // Opt-in pre-install DB snapshot (MODULE_INSTALL_BACKUP=1). Runs
        // AFTER validation so a rejected upload never creates a backup
        // file, but BEFORE the file-system change so ops can roll back
        // the DB to its pre-upload state if a later migration explodes.
        await backupBeforeModuleChange(exists ? "update" : "install", manifest.id);

        if (exists) {
            await fs.rm(targetDir, { recursive: true, force: true });
        }

        await fs.cp(manifestDir, targetDir, { recursive: true });
        createdTargetDir = targetDir;

        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: "pipe",
            });
        } catch (err: unknown) {
            await fs.rm(targetDir, { recursive: true, force: true });
            createdTargetDir = null;
            const detail = process.env.NEXT_DEV ? ": " + (err instanceof Error ? err.message : "Unknown error") : "";
            return NextResponse.json({ error: "Module has errors — registry generation failed" + detail }, { status: 400 });
        }

        const installedAt = new Date();
        const hash = manifestHash(manifest);
        await prisma.moduleConfig.upsert({
            where: { id: manifest.id },
            update: {
                name: manifest.name,
                manifestHash: hash,
                installedAt,
                installedByUserId: session.user.id,
            },
            create: {
                id: manifest.id,
                name: manifest.name,
                enabled: false,
                manifestHash: hash,
                installedAt,
                installedByUserId: session.user.id,
            },
        });

        return NextResponse.json({
            message: "Module installed successfully",
            module: { id: manifest.id, name: manifest.name, version: manifest.version, enabled: false },
        });
    } catch (err: unknown) {
        if (createdTargetDir) {
            await fs.rm(createdTargetDir, { recursive: true, force: true }).catch(() => {});
        }
        const msg = process.env.NODE_ENV === "production"
            ? "Operation failed"
            : (err instanceof Error ? err.message : "Unknown error");
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        if (extractDir) {
            await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        }
        releaseLock();
    }
}
