import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { z } from "zod";

const THEMES_DIR = path.join(process.cwd(), "src/themes");

// Validate theme.json structure
const themeJsonSchema = z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
    name: z.string().min(1),
    description: z.string().optional(),
    author: z.string().optional(),
    version: z.string().optional(),
    type: z.enum(["light", "dark"]).default("light"),
    colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        background: z.string(),
        foreground: z.string(),
        muted: z.string(),
        mutedForeground: z.string(),
        border: z.string(),
        card: z.string(),
        cardForeground: z.string(),
        destructive: z.string(),
        success: z.string(),
        warning: z.string(),
    }),
    fonts: z.object({
        heading: z.string(),
        body: z.string(),
        mono: z.string(),
    }).optional(),
    radius: z.string().optional(),
    css: z.string().optional(),
});

// POST /api/v1/themes/upload - Upload theme ZIP
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (!file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "File must be a ZIP archive" }, { status: 400 });
        }

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        // Find theme.json in the ZIP
        let themeJsonEntry = entries.find((e) => e.entryName === "theme.json");

        // Also check if it's nested in a folder (e.g., mytheme/theme.json)
        if (!themeJsonEntry) {
            themeJsonEntry = entries.find((e) => e.entryName.endsWith("/theme.json") && e.entryName.split("/").length === 2);
        }

        if (!themeJsonEntry) {
            return NextResponse.json({ error: "ZIP must contain a theme.json file" }, { status: 400 });
        }

        // Parse and validate theme.json
        let themeJson;
        try {
            themeJson = JSON.parse(themeJsonEntry.getData().toString("utf-8"));
        } catch {
            return NextResponse.json({ error: "Invalid theme.json format" }, { status: 400 });
        }

        const validation = themeJsonSchema.safeParse(themeJson);
        if (!validation.success) {
            return NextResponse.json({
                error: "Invalid theme.json schema",
                details: validation.error.issues.map((e: any) => `${String(e.path?.join?.(".") || "")}: ${e.message}`),
            }, { status: 400 });
        }

        const theme = validation.data;
        const themeDir = path.join(THEMES_DIR, theme.id);

        // Check if theme already exists
        if (fs.existsSync(themeDir)) {
            return NextResponse.json({ error: `Theme "${theme.id}" already exists. Delete it first.` }, { status: 400 });
        }

        // Determine the prefix for entries (in case files are nested in a folder)
        const prefix = themeJsonEntry.entryName.replace("theme.json", "");

        // Extract files
        fs.mkdirSync(themeDir, { recursive: true });

        for (const entry of entries) {
            if (entry.isDirectory) continue;

            // Get relative path
            let relativePath = entry.entryName;
            if (prefix && relativePath.startsWith(prefix)) {
                relativePath = relativePath.substring(prefix.length);
            }

            // Security: prevent path traversal
            if (relativePath.includes("..")) continue;

            // Only allow specific file types
            const ext = path.extname(relativePath).toLowerCase();
            if (![".json", ".ts", ".tsx", ".css", ".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(ext)) continue;

            // Security: verify resolved path stays within theme directory
            const resolvedTarget = path.resolve(path.join(themeDir, relativePath));
            if (!resolvedTarget.startsWith(path.resolve(themeDir) + path.sep)) continue;

            const targetPath = path.join(themeDir, relativePath);
            const targetDir = path.dirname(targetPath);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            fs.writeFileSync(targetPath, entry.getData());
        }

        // Generate theme.config.ts from theme.json if not present in ZIP
        const configPath = path.join(themeDir, "theme.config.ts");
        if (!fs.existsSync(configPath)) {
            const configContent = `import { ThemeConfig } from "@/core/types/theme";

export const ${theme.id.replace(/-/g, "")}Theme: ThemeConfig = ${JSON.stringify({
                id: theme.id,
                name: theme.name,
                description: theme.description || "",
                author: theme.author || "",
                version: theme.version || "1.0.0",
                type: theme.type,
                colors: theme.colors,
                fonts: theme.fonts || { heading: "var(--font-heading)", body: "var(--font-body)", mono: "var(--font-mono)" },
                radius: theme.radius || "0.5rem",
                css: theme.css || "",
            }, null, 4)};
`;
            fs.writeFileSync(configPath, configContent);
        }

        return NextResponse.json({
            message: `Theme "${theme.name}" installed successfully. Run theme generation to activate.`,
            theme: {
                id: theme.id,
                name: theme.name,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("Theme upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
