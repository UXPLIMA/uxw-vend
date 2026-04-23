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
            const jsonPath = path.join(THEMES_DIR, themeId, "theme.json");
            if (!fs.existsSync(jsonPath)) return null;

            let meta: Record<string, unknown> = { id: themeId };
            try {
                meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
            } catch {
                return null;
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
                componentCount,
            };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

    return NextResponse.json({ themes });
}
