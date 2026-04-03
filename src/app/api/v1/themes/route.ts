import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs";
import path from "path";

const THEMES_DIR = path.join(process.cwd(), "src/themes");

// GET /api/v1/themes - List installed themes
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!fs.existsSync(THEMES_DIR)) {
        return NextResponse.json({ themes: [] });
    }

    const themes = fs.readdirSync(THEMES_DIR)
        .filter((f) => fs.statSync(path.join(THEMES_DIR, f)).isDirectory())
        .map((themeId) => {
            const configPath = path.join(THEMES_DIR, themeId, "theme.config.ts");
            const jsonPath = path.join(THEMES_DIR, themeId, "theme.json");
            const hasConfig = fs.existsSync(configPath);
            const hasJson = fs.existsSync(jsonPath);

            let meta: Record<string, unknown> = { id: themeId };
            if (hasJson) {
                try {
                    meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
                } catch { /* ignore */ }
            }

            const componentsDir = path.join(THEMES_DIR, themeId, "components");
            const componentCount = fs.existsSync(componentsDir)
                ? fs.readdirSync(componentsDir).filter((f) => f.endsWith(".tsx")).length
                : 0;

            return {
                id: themeId,
                name: meta.name || themeId,
                description: meta.description || "",
                author: meta.author || "",
                version: meta.version || "1.0.0",
                hasConfig,
                componentCount,
            };
        });

    return NextResponse.json({ themes });
}
