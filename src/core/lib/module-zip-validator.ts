import type AdmZip from "adm-zip";

export interface ZipValidationResult {
    ok: boolean;
    error?: string;
}

const ALLOWED_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".txt",
    ".css", ".scss", ".sass", ".less",
    ".html", ".svg",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".prisma", ".sql",
    ".yaml", ".yml", ".toml",
]);

const DENY_BASENAMES = new Set([
    ".env", ".env.local", ".env.production", ".env.development",
    ".git", ".gitconfig", ".gitattributes",
    ".ssh", ".aws", ".docker", ".npmrc", ".yarnrc",
    "id_rsa", "id_rsa.pub", "authorized_keys", "known_hosts",
    ".htaccess", ".htpasswd",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]);

const DENY_PATH_SEGMENTS = new Set([
    "node_modules", ".git", ".svn", ".hg",
    ".vscode", ".idea", ".DS_Store",
]);

const MAX_ENTRIES = 2000;
const MAX_ENTRY_UNCOMPRESSED = 10 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

function isSymlinkEntry(entry: AdmZip.IZipEntry): boolean {
    const attr = entry.attr >>> 16;
    const S_IFMT = 0o170000;
    const S_IFLNK = 0o120000;
    return (attr & S_IFMT) === S_IFLNK;
}

function getExtension(name: string): string {
    const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
    const base = name.slice(lastSlash + 1);
    const dot = base.lastIndexOf(".");
    if (dot <= 0) return "";
    return base.slice(dot).toLowerCase();
}

export function validateZipEntries(entries: AdmZip.IZipEntry[]): ZipValidationResult {
    if (entries.length === 0) return { ok: false, error: "Archive is empty" };
    if (entries.length > MAX_ENTRIES) return { ok: false, error: `Archive has too many entries (max ${MAX_ENTRIES})` };

    let totalUncompressed = 0;

    for (const entry of entries) {
        const name = entry.entryName;

        if (!name || name.length > 1024) {
            return { ok: false, error: "Archive contains an invalid entry name" };
        }

        if (isSymlinkEntry(entry)) {
            return { ok: false, error: `Symlinks are not allowed: ${name}` };
        }

        if (name.includes("\0")) {
            return { ok: false, error: `Entry name contains null byte: ${name}` };
        }

        if (name.startsWith("/") || /^[A-Za-z]:[\\/]/.test(name)) {
            return { ok: false, error: `Absolute paths are not allowed: ${name}` };
        }

        const segments = name.split(/[\\/]/).filter(Boolean);
        if (segments.some((s) => s === "..")) {
            return { ok: false, error: `Path traversal in archive: ${name}` };
        }
        if (segments.some((s) => DENY_PATH_SEGMENTS.has(s))) {
            return { ok: false, error: `Forbidden directory in archive: ${name}` };
        }

        if (entry.isDirectory) continue;

        const basename = segments[segments.length - 1] ?? "";
        if (DENY_BASENAMES.has(basename) || DENY_BASENAMES.has(basename.toLowerCase())) {
            return { ok: false, error: `Forbidden file in archive: ${name}` };
        }

        const ext = getExtension(basename);
        if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
            return { ok: false, error: `Disallowed file type: ${name}` };
        }

        const uncompressed = entry.header.size;
        const compressed = entry.header.compressedSize;

        if (uncompressed > MAX_ENTRY_UNCOMPRESSED) {
            return { ok: false, error: `Entry exceeds size limit: ${name}` };
        }

        if (compressed > 0 && uncompressed / compressed > MAX_COMPRESSION_RATIO) {
            return { ok: false, error: `Suspicious compression ratio: ${name}` };
        }

        totalUncompressed += uncompressed;
        if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
            return { ok: false, error: "Archive uncompressed size is too large" };
        }
    }

    return { ok: true };
}
