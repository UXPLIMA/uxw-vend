import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/theme-marketplace";

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { themeId, zipFile } = await request.json();
        if (!themeId || !zipFile) return NextResponse.json({ error: "themeId and zipFile required" }, { status: 400 });

        const targetDir = path.join(THEMES_DIR, themeId);
        if (await fs.access(targetDir).then(() => true).catch(() => false)) {
            return NextResponse.json({ error: "Theme already installed" }, { status: 409 });
        }

        // Download ZIP
        const res = await fetch(`${MARKETPLACE_BASE}/${zipFile}`);
        if (!res.ok) return NextResponse.json({ error: `Download failed: HTTP ${res.status}` }, { status: 502 });

        const buffer = Buffer.from(await res.arrayBuffer());
        const tmpDir = path.join(process.cwd(), "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        const zipPath = path.join(tmpDir, `theme-${themeId}-${Date.now()}.zip`);
        await fs.writeFile(zipPath, buffer);

        // Extract
        await fs.mkdir(targetDir, { recursive: true });
        execSync(`unzip -o "${zipPath}" -d "${targetDir}"`, { timeout: 30000 });

        // Verify theme.config.ts exists
        const configPath = path.join(targetDir, "theme.config.ts");
        if (!(await fs.access(configPath).then(() => true).catch(() => false))) {
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Invalid theme — no theme.config.ts" }, { status: 400 });
        }

        // Regenerate theme registry
        try {
            execSync("npx tsx scripts/generate-themes.ts", { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
        } catch (err: unknown) {
            await fs.rm(targetDir, { recursive: true, force: true });
            await fs.rm(zipPath, { force: true });
            return NextResponse.json({ error: "Theme registry failed: " + (String((err as Error)?.message || err).slice(0, 200)) }, { status: 400 });
        }

        await fs.rm(zipPath, { force: true });

        return NextResponse.json({ message: "Theme installed", theme: { id: themeId } });
    } catch (err: unknown) {
        return NextResponse.json({ error: "Install failed: " + (err instanceof Error ? err.message : "Unknown") }, { status: 500 });
    }
}
