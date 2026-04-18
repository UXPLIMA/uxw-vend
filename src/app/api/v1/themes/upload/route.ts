import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { rateLimit } from "@/core/lib/rate-limit";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { execFileSync } from "child_process";
import { ThemeType } from "@prisma/client";
import { themeManifestSchema } from "@/core/lib/theme-manifest-schema";
import { validateZipEntries } from "@/core/lib/module-zip-validator";
import { manifestHash } from "@/core/lib/module-install-audit";
import { PROJECT_ROOT } from "@/core/lib/runtime-paths";
import { devOnlyDetail } from "@/core/lib/api-utils";

const THEMES_DIR = path.join(PROJECT_ROOT, "src/themes");
const RESERVED_IDS = new Set(["flat", "flat-dark", "core", "admin"]);

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rl = await rateLimit(`theme-upload:${session.user.id}`, { maxRequests: 3, windowMs: 3_600_000 });
    if (!rl.success) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

    let extractDir: string | null = null;
    try {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || !file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "Upload a .zip" }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return NextResponse.json({ error: "Invalid ZIP" }, { status: 400 });

        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const check = validateZipEntries(entries);
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

        extractDir = path.join(PROJECT_ROOT, "tmp", `theme-extract-${Date.now()}`);
        await fs.mkdir(extractDir, { recursive: true });
        const extractRoot = path.resolve(extractDir);
        for (const e of entries) {
            if (e.isDirectory) continue;
            const resolved = path.resolve(extractDir, e.entryName);
            if (!resolved.startsWith(extractRoot + path.sep)) continue;
            await fs.mkdir(path.dirname(resolved), { recursive: true });
            await fs.writeFile(resolved, e.getData());
        }

        const manifestPath = path.join(extractDir, "theme.json");
        const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
        if (!manifestExists) {
            return NextResponse.json({ error: "theme.json missing" }, { status: 400 });
        }
        let raw: unknown;
        try { raw = JSON.parse(await fs.readFile(manifestPath, "utf-8")); }
        catch { return NextResponse.json({ error: "theme.json invalid JSON" }, { status: 400 }); }

        const parsed = themeManifestSchema.safeParse(raw);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return NextResponse.json({ error: `theme.json invalid: ${first.path.join(".")} ${first.message}` }, { status: 400 });
        }
        const manifest = parsed.data;
        if (RESERVED_IDS.has(manifest.id)) return NextResponse.json({ error: "Theme id is reserved" }, { status: 400 });

        const target = path.join(THEMES_DIR, manifest.id);
        const targetResolved = path.resolve(target);
        if (!targetResolved.startsWith(path.resolve(THEMES_DIR) + path.sep)) {
            return NextResponse.json({ error: "Invalid theme path" }, { status: 400 });
        }
        const exists = await fs.access(target).then(() => true).catch(() => false);
        if (exists) await fs.rm(target, { recursive: true, force: true });
        await fs.cp(extractDir, target, { recursive: true });

        try {
            execFileSync("npx", ["tsx", "scripts/generate-theme-registry.ts"], { cwd: PROJECT_ROOT, timeout: 30_000, stdio: "pipe" });
        } catch (e) {
            await fs.rm(target, { recursive: true, force: true });
            return NextResponse.json({ error: "Theme failed regeneration", details: devOnlyDetail(e) }, { status: 400 });
        }

        const hash = manifestHash(manifest);
        const dbType: ThemeType = manifest.type === "dark" ? ThemeType.DARK : ThemeType.LIGHT;
        await prisma.theme.upsert({
            where: { id: manifest.id },
            create: {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                parent: manifest.parent ?? null,
                type: dbType,
                manifestHash: hash,
                installedById: session.user.id,
            },
            update: {
                name: manifest.name,
                version: manifest.version,
                parent: manifest.parent ?? null,
                type: dbType,
                manifestHash: hash,
                installedById: session.user.id,
            },
        });

        return NextResponse.json({ ok: true, id: manifest.id });
    } catch (err) {
        return NextResponse.json({ error: "Upload failed", details: devOnlyDetail(err) }, { status: 500 });
    } finally {
        if (extractDir) await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
}
