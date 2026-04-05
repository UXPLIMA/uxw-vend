import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/theme-marketplace";

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { themeId, zipFile } = await request.json();
        if (!themeId || !zipFile) return NextResponse.json({ error: "themeId and zipFile required" }, { status: 400 });

        // Validate zipFile to prevent SSRF / path traversal
        if (!/^[a-z0-9-]+\.zip$/.test(zipFile)) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        const targetDir = path.join(THEMES_DIR, themeId);
        if (await fs.access(targetDir).then(() => true).catch(() => false)) {
            return NextResponse.json({ error: "Theme already installed" }, { status: 409 });
        }

        // Download ZIP with size limit
        const res = await fetch(`${MARKETPLACE_BASE}/${zipFile}`);
        if (!res.ok) return NextResponse.json({ error: `Download failed: HTTP ${res.status}` }, { status: 502 });

        const contentLength = res.headers.get("content-length");
        const MAX_THEME_SIZE = 50 * 1024 * 1024; // 50MB
        if (contentLength && parseInt(contentLength, 10) > MAX_THEME_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_THEME_SIZE) {
            return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
        }

        // Validate ZIP magic number
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
        }

        // Extract using adm-zip (no shell, path traversal protected)
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

        // Verify theme.config.ts exists
        const configPath = path.join(targetDir, "theme.config.ts");
        if (!(await fs.access(configPath).then(() => true).catch(() => false))) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Invalid theme — no theme.config.ts" }, { status: 400 });
        }

        // Regenerate theme registry
        try {
            execFileSync("npx", ["tsx", "scripts/generate-themes.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
        } catch (err: unknown) {
            await fs.rm(targetDir, { recursive: true, force: true });
            return NextResponse.json({ error: "Theme registry failed: " + (String((err as Error)?.message || err).slice(0, 200)) }, { status: 400 });
        }

        return NextResponse.json({ message: "Theme installed", theme: { id: themeId } });
    } catch (err: unknown) {
        const msg = process.env.NODE_ENV === 'production'
            ? 'Operation failed'
            : (err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
