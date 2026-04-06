import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { execFile } from "child_process";
import { promisify } from "util";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 7;

// GET /api/v1/admin/backup - List available backups
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const files = await fs.readdir(BACKUP_DIR);
        const backups = [];

        for (const file of files) {
            if (!file.endsWith(".zip") && !file.endsWith(".sql") && !file.endsWith(".sql.gz")) continue;
            const stat = await fs.stat(path.join(BACKUP_DIR, file));
            backups.push({
                filename: file,
                size: stat.size,
                sizeHuman: formatBytes(stat.size),
                createdAt: stat.mtime.toISOString(),
            });
        }

        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ backups, total: backups.length });
    } catch {
        return NextResponse.json({ error: "Failed to list backups" }, { status: 500 });
    }
}

// POST /api/v1/admin/backup - Create full backup (DB + modules + translations)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const zipName = `uxwvend_${timestamp}.zip`;
        const zipPath = path.join(BACKUP_DIR, zipName);
        const dbDumpPath = path.join(BACKUP_DIR, `_tmp_db_${timestamp}.sql`);

        // 1. Database dump
        try {
            await execFileAsync("pg_dump", [databaseUrl, "-f", dbDumpPath], { timeout: 120000 });
        } catch {
            await fs.writeFile(dbDumpPath, "-- pg_dump not available. Use: prisma db pull\n");
        }

        // 2. Create ZIP
        const zip = new AdmZip();

        // DB dump
        zip.addLocalFile(dbDumpPath, "", "database.sql");

        // Installed modules
        const modulesDir = path.join(process.cwd(), "src/modules");
        if (fsSync.existsSync(modulesDir)) {
            const modules = fsSync.readdirSync(modulesDir).filter((f) => f !== ".gitkeep");
            for (const mod of modules) {
                const modPath = path.join(modulesDir, mod);
                if (fsSync.statSync(modPath).isDirectory()) {
                    zip.addLocalFolder(modPath, `modules/${mod}`);
                }
            }
        }

        // Translation files
        const messagesDir = path.join(process.cwd(), "messages");
        if (fsSync.existsSync(messagesDir)) {
            zip.addLocalFolder(messagesDir, "messages");
        }

        // Prisma schema
        const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
        if (fsSync.existsSync(schemaPath)) {
            zip.addLocalFile(schemaPath, "prisma");
        }

        // Installed themes
        const themesDir = path.join(process.cwd(), "src/themes");
        if (fsSync.existsSync(themesDir)) {
            zip.addLocalFolder(themesDir, "themes");
        }

        zip.writeZip(zipPath);

        // Cleanup temp
        try { await fs.unlink(dbDumpPath); } catch { /* ignore */ }

        // Cleanup old backups
        await cleanupOldBackups();

        const stat = await fs.stat(zipPath);

        return NextResponse.json({
            message: "Backup created",
            backup: {
                filename: zipName,
                size: stat.size,
                sizeHuman: formatBytes(stat.size),
                createdAt: stat.mtime.toISOString(),
            },
        }, { status: 201 });
    } catch (err) {
        const detail = process.env.NEXT_DEV ? `: ${(err as Error).message}` : "";
        return NextResponse.json({ error: "Backup failed" + detail }, { status: 500 });
    }

    void request;
}

async function cleanupOldBackups() {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files
            .filter(f => f.startsWith("uxwvend_"))
            .sort()
            .reverse();

        for (const file of backupFiles.slice(MAX_BACKUPS)) {
            await fs.unlink(path.join(BACKUP_DIR, file)).catch(() => {});
        }
    } catch { /* non-fatal */ }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
