import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsAsync from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), "backups");

// POST /api/v1/admin/backup/restore — Restore from a backup ZIP
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { filename } = await request.json();
    if (!filename || typeof filename !== "string") {
        return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    // Validate filename
    if (!/^uxwvend_[\w-]+\.zip$/.test(filename) || filename.includes("..")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const zipPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(zipPath)) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const restored: string[] = [];

    try {
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();

        // 1. Restore database
        const dbEntry = entries.find((e) => e.entryName === "database.sql");
        if (dbEntry) {
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
                const tmpSql = path.join(BACKUP_DIR, `_restore_${Date.now()}.sql`);
                zip.extractEntryTo(dbEntry, BACKUP_DIR, false, true, false, "_restore_" + Date.now() + ".sql");
                // Write the SQL content manually
                await fsAsync.writeFile(tmpSql, dbEntry.getData());
                try {
                    await execFileAsync("psql", [dbUrl, "-f", tmpSql], { timeout: 120000 });
                    restored.push("database");
                } catch {
                    restored.push("database (failed — check server logs)");
                }
                try { await fsAsync.unlink(tmpSql); } catch { /* ignore */ }
            }
        }

        // 2. Restore modules
        const moduleEntries = entries.filter((e) => e.entryName.startsWith("modules/") && !e.isDirectory);
        if (moduleEntries.length > 0) {
            const modulesDir = path.join(process.cwd(), "src/modules");
            await fsAsync.mkdir(modulesDir, { recursive: true });

            for (const entry of moduleEntries) {
                const relativePath = entry.entryName.replace("modules/", "");
                const targetPath = path.join(modulesDir, relativePath);

                // Path traversal check
                if (!targetPath.startsWith(modulesDir)) continue;

                await fsAsync.mkdir(path.dirname(targetPath), { recursive: true });
                await fsAsync.writeFile(targetPath, entry.getData());
            }
            restored.push(`modules (${new Set(moduleEntries.map((e) => e.entryName.split("/")[1])).size} modules)`);
        }

        // 3. Restore translations
        const msgEntries = entries.filter((e) => e.entryName.startsWith("messages/") && e.entryName.endsWith(".json"));
        if (msgEntries.length > 0) {
            const messagesDir = path.join(process.cwd(), "messages");
            for (const entry of msgEntries) {
                const filename = path.basename(entry.entryName);
                const targetPath = path.join(messagesDir, filename);
                if (!targetPath.startsWith(messagesDir)) continue;
                await fsAsync.writeFile(targetPath, entry.getData());
            }
            restored.push(`translations (${msgEntries.length} files)`);
        }

        // 4. Restore themes
        const themeEntries = entries.filter((e) => e.entryName.startsWith("themes/") && !e.isDirectory);
        if (themeEntries.length > 0) {
            const themesDir = path.join(process.cwd(), "src/themes");
            for (const entry of themeEntries) {
                const relativePath = entry.entryName.replace("themes/", "");
                const targetPath = path.join(themesDir, relativePath);
                if (!targetPath.startsWith(themesDir)) continue;
                await fsAsync.mkdir(path.dirname(targetPath), { recursive: true });
                await fsAsync.writeFile(targetPath, entry.getData());
            }
            restored.push("themes");
        }

        // 5. Regenerate registry if modules were restored
        if (moduleEntries.length > 0) {
            try {
                await execFileAsync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: process.cwd(), timeout: 30000 });
                await execFileAsync("npx", ["tsx", "scripts/merge-schemas.ts"], { cwd: process.cwd(), timeout: 30000 });
                restored.push("registry regenerated");
            } catch {
                restored.push("registry regeneration failed — run manually: npm run predev");
            }
        }

        return NextResponse.json({ message: "Restore completed", restored });
    } catch (err) {
        const detail = process.env.NEXT_DEV ? `: ${(err as Error).message}` : "";
        return NextResponse.json({ error: "Restore failed" + detail }, { status: 500 });
    }
}
