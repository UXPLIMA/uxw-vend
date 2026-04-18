/**
 * Database backup & restore library.
 *
 * Wraps `pg_dump` + `gzip` to create compressed SQL dumps of the PostgreSQL
 * database configured via DATABASE_URL, and `gunzip` + `psql` to restore them.
 *
 * All files live in the top-level `backups/` directory (gitignored).
 *
 * Filename convention:
 *     uxwvend-{type}-{ISO-date-safe}.sql.gz
 *   e.g. uxwvend-manual-2026-04-08T12-34-56-789Z.sql.gz
 *
 * The `id` used by the public API is the filename WITHOUT the `.sql.gz`
 * extension — deterministic, collision-free, and safe to use in URLs.
 */

import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import zlib from "zlib";
import { pipeline } from "stream/promises";

export interface BackupMeta {
    id: string;
    filename: string;
    sizeBytes: number;
    createdAt: Date;
    type: "manual" | "scheduled";
    notes?: string;
}

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const FILE_EXT = ".sql.gz";
const FILENAME_RE = /^uxwvend-(manual|scheduled)-([0-9TZ\-]+)\.sql\.gz$/;

const RETAIN_MANUAL = 10;
const RETAIN_SCHEDULED = 30;

// ─── helpers ──────────────────────────────────────────────────────────────

async function ensureBackupDir(): Promise<void> {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
}

function parsePgEnv(): NodeJS.ProcessEnv {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL not configured");
    }
    const parsed = new URL(url);
    const pgEnv: NodeJS.ProcessEnv = { ...process.env };
    pgEnv.PGHOST = parsed.hostname;
    pgEnv.PGPORT = parsed.port || "5432";
    pgEnv.PGDATABASE = parsed.pathname.replace(/^\//, "");
    if (parsed.username) pgEnv.PGUSER = decodeURIComponent(parsed.username);
    if (parsed.password) pgEnv.PGPASSWORD = decodeURIComponent(parsed.password);
    // Strip DATABASE_URL from spawned env so nothing accidentally logs it
    delete pgEnv.DATABASE_URL;
    return pgEnv;
}

function safeTimestamp(date: Date): string {
    // ISO with colons/dots replaced by dashes → still lexically sortable
    return date.toISOString().replace(/[:.]/g, "-");
}

function buildFilename(type: "manual" | "scheduled", date: Date): string {
    return `uxwvend-${type}-${safeTimestamp(date)}${FILE_EXT}`;
}

function idToFilename(id: string): string | null {
    const filename = `${id}${FILE_EXT}`;
    if (!FILENAME_RE.test(filename)) return null;
    return filename;
}

function filenameToId(filename: string): string {
    return filename.replace(FILE_EXT, "");
}

function resolveBackupPath(id: string): string | null {
    const filename = idToFilename(id);
    if (!filename) return null;
    const full = path.resolve(BACKUP_DIR, filename);
    // Defence-in-depth against traversal: must stay under BACKUP_DIR
    if (!full.startsWith(BACKUP_DIR + path.sep) && full !== BACKUP_DIR) {
        return null;
    }
    return full;
}

async function readNotes(filename: string): Promise<string | undefined> {
    const notePath = path.join(BACKUP_DIR, `${filename}.note`);
    try {
        return (await fsp.readFile(notePath, "utf8")).trim() || undefined;
    } catch {
        return undefined;
    }
}

async function writeNotes(filename: string, notes: string): Promise<void> {
    const notePath = path.join(BACKUP_DIR, `${filename}.note`);
    await fsp.writeFile(notePath, notes, "utf8");
}

async function deleteNotes(filename: string): Promise<void> {
    const notePath = path.join(BACKUP_DIR, `${filename}.note`);
    try { await fsp.unlink(notePath); } catch { /* ignore */ }
}

// ─── public API ───────────────────────────────────────────────────────────

/**
 * Run `pg_dump | gzip` and write the archive to disk. Blocks until pg_dump
 * exits (success → code 0). Rotates old backups after completion.
 */
export async function createBackup(
    type: "manual" | "scheduled",
    notes?: string,
): Promise<BackupMeta> {
    await ensureBackupDir();

    const createdAt = new Date();
    const filename = buildFilename(type, createdAt);
    const fullPath = path.join(BACKUP_DIR, filename);

    const pgEnv = parsePgEnv();

    // Run pg_dump --no-owner --no-acl so the dump restores cleanly on any role
    const pgDump = spawn(
        "pg_dump",
        ["--no-owner", "--no-acl", "--clean", "--if-exists"],
        { env: pgEnv, stdio: ["ignore", "pipe", "pipe"] },
    );

    let pgStderr = "";
    pgDump.stderr.on("data", (chunk: Buffer) => { pgStderr += chunk.toString(); });

    const gzip = zlib.createGzip();
    const writeStream = fs.createWriteStream(fullPath);

    try {
        await Promise.all([
            // pg_dump stdout → gzip → file
            pipeline(pgDump.stdout, gzip, writeStream),
            // wait for pg_dump to exit
            new Promise<void>((resolve, reject) => {
                pgDump.on("error", (err) => reject(err));
                pgDump.on("exit", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`pg_dump exited with code ${code}${pgStderr ? `: ${pgStderr.trim()}` : ""}`));
                });
            }),
        ]);
    } catch (err) {
        // Remove any partial file
        try { await fsp.unlink(fullPath); } catch { /* ignore */ }
        throw err instanceof Error ? err : new Error(String(err));
    }

    if (notes && notes.trim()) {
        await writeNotes(filename, notes.trim());
    }

    // Rotate old backups per retention policy
    try {
        await rotateBackups();
    } catch {
        // Retention failure is non-fatal
    }

    const stat = await fsp.stat(fullPath);
    return {
        id: filenameToId(filename),
        filename,
        sizeBytes: stat.size,
        createdAt: stat.birthtime ?? stat.mtime,
        type,
        notes: notes?.trim() || undefined,
    };
}

/**
 * Enumerate backups in the directory. Sorted newest first.
 */
export async function listBackups(): Promise<BackupMeta[]> {
    await ensureBackupDir();
    const entries = await fsp.readdir(BACKUP_DIR);
    const results: BackupMeta[] = [];

    for (const filename of entries) {
        const match = FILENAME_RE.exec(filename);
        if (!match) continue;
        const type = match[1] as "manual" | "scheduled";
        const full = path.join(BACKUP_DIR, filename);
        let stat: fs.Stats;
        try {
            stat = await fsp.stat(full);
        } catch {
            continue;
        }
        if (!stat.isFile()) continue;

        const notes = await readNotes(filename);

        results.push({
            id: filenameToId(filename),
            filename,
            sizeBytes: stat.size,
            createdAt: stat.birthtime && stat.birthtime.getTime() > 0 ? stat.birthtime : stat.mtime,
            type,
            notes,
        });
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results;
}

/**
 * Delete a backup by id. Silently no-ops on unknown id.
 */
export async function deleteBackup(id: string): Promise<void> {
    const fullPath = resolveBackupPath(id);
    if (!fullPath) return;
    const filename = path.basename(fullPath);
    try {
        await fsp.unlink(fullPath);
    } catch {
        // ignore missing
    }
    await deleteNotes(filename);
}

/**
 * Restore a backup. Runs `gunzip -c {file} | psql` with the same PG env vars.
 * DANGEROUS: truncates/recreates every table via pg_dump's `--clean --if-exists`
 * directives. Returns a result object instead of throwing so callers can show
 * a clean error message.
 */
export async function restoreBackup(id: string): Promise<{ success: boolean; error?: string }> {
    const fullPath = resolveBackupPath(id);
    if (!fullPath) {
        return { success: false, error: "Invalid backup id" };
    }
    try {
        await fsp.access(fullPath);
    } catch {
        return { success: false, error: "Backup not found" };
    }

    let pgEnv: NodeJS.ProcessEnv;
    try {
        pgEnv = parsePgEnv();
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "PG env error" };
    }

    return new Promise((resolve) => {
        const psql = spawn("psql", ["--quiet", "--set=ON_ERROR_STOP=1"], {
            env: pgEnv,
            stdio: ["pipe", "ignore", "pipe"],
        });

        let psqlStderr = "";
        psql.stderr.on("data", (chunk: Buffer) => { psqlStderr += chunk.toString(); });
        psql.on("error", (err) => {
            resolve({ success: false, error: err.message });
        });
        psql.on("exit", (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({
                    success: false,
                    error: `psql exited with code ${code}${psqlStderr ? `: ${psqlStderr.trim().slice(0, 500)}` : ""}`,
                });
            }
        });

        const readStream = fs.createReadStream(fullPath);
        const gunzip = zlib.createGunzip();
        readStream.on("error", (err) => {
            resolve({ success: false, error: err.message });
            try { psql.kill(); } catch { /* ignore */ }
        });
        gunzip.on("error", (err) => {
            resolve({ success: false, error: err.message });
            try { psql.kill(); } catch { /* ignore */ }
        });

        readStream.pipe(gunzip).pipe(psql.stdin);
    });
}

/**
 * Resolve the on-disk path for a given backup id. Returns null if the id is
 * invalid or the file does not exist. Safe for use by file-serving endpoints.
 */
export async function getBackupPath(id: string): Promise<string | null> {
    const fullPath = resolveBackupPath(id);
    if (!fullPath) return null;
    try {
        const stat = await fsp.stat(fullPath);
        if (!stat.isFile()) return null;
    } catch {
        return null;
    }
    return fullPath;
}

/**
 * Retention: keep the newest `RETAIN_MANUAL` manual and `RETAIN_SCHEDULED`
 * scheduled backups. Delete everything older in each category.
 */
async function rotateBackups(): Promise<void> {
    const all = await listBackups(); // already sorted newest first
    const byType: Record<"manual" | "scheduled", BackupMeta[]> = {
        manual: [],
        scheduled: [],
    };
    for (const b of all) byType[b.type].push(b);

    const toDelete: BackupMeta[] = [
        ...byType.manual.slice(RETAIN_MANUAL),
        ...byType.scheduled.slice(RETAIN_SCHEDULED),
    ];

    for (const b of toDelete) {
        await deleteBackup(b.id);
    }
}

// ─── presentation helpers (usable by API layer) ─────────────────────────────

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
