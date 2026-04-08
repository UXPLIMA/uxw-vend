import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/core/lib/db";

/**
 * Generic storage provider interface.
 *
 * Storage providers are pluggable modules that implement file persistence
 * (S3, R2, B2, MinIO, GCS, etc.). Core knows nothing about specific providers.
 *
 * The "local" provider below is core's built-in filesystem fallback. It is NOT
 * a module — it is the zero-config default behavior when no provider module
 * is installed or active.
 *
 * Modules register themselves via the `storageProviders` field in module.json.
 * The build-time registry generator collects them into StorageProviderRegistry.
 */

export interface UploadResult {
    url: string;
    path: string;
}

export interface StorageProvider {
    /** Persist a file. Returns the public URL and storage path. */
    upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set<string>([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/json",
    "text/plain",
]);

export function sanitizeFilename(filename: string): string {
    let safe = filename
        .replace(/\.\.+/g, "-")
        .replace(/[/\\]/g, "-")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x7f]/g, "-")
        .replace(/[^A-Za-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!safe || safe === "." || safe === "..") safe = "file";
    if (safe.length > 120) {
        const ext = path.extname(safe);
        const base = safe.slice(0, 120 - ext.length);
        safe = base + ext;
    }
    return safe;
}

/** Built-in local filesystem provider. Not a module, just core's default. */
export const localStorageProvider: StorageProvider = {
    async upload(buffer, filename) {
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });
        const safe = sanitizeFilename(filename);
        const key = `${crypto.randomUUID()}-${safe}`;
        const filePath = path.join(uploadsDir, key);
        const resolvedDir = path.resolve(uploadsDir);
        const resolvedFile = path.resolve(filePath);
        if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
            throw new Error("Invalid filename");
        }
        await fs.writeFile(filePath, buffer);
        return { url: `/uploads/${key}`, path: `public/uploads/${key}` };
    },
};

/**
 * Resolve the active storage provider.
 *
 * Priority:
 *  1. Setting key `storage_active_provider` (admin-configurable)
 *  2. Env var STORAGE_PROVIDER
 *  3. Built-in local filesystem
 *
 * If the configured provider id isn't registered (module not installed),
 * silently falls back to local.
 */
async function resolveActiveProvider(): Promise<StorageProvider> {
    let providerId: string | null = null;

    try {
        const setting = await prisma.setting.findUnique({
            where: { key: "storage_active_provider" },
        });
        if (setting && typeof setting.value === "string") {
            providerId = setting.value;
        } else if (setting && setting.value && typeof setting.value === "object") {
            providerId = (setting.value as { id?: string }).id || null;
        }
    } catch {
        // ignore — fall through to env / local
    }

    if (!providerId) {
        providerId = process.env.STORAGE_PROVIDER || null;
    }

    if (!providerId || providerId === "local") {
        return localStorageProvider;
    }

    try {
        const { StorageProviderRegistry } = await import("@/core/generated/module-storage");
        const loader = (StorageProviderRegistry as Record<string, () => Promise<StorageProvider>>)[providerId];
        if (!loader) return localStorageProvider;
        const provider = await loader();
        return provider || localStorageProvider;
    } catch {
        return localStorageProvider;
    }
}

/** Validate + delegate to the active storage provider. */
export async function uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
): Promise<UploadResult> {
    if (!filename || typeof filename !== "string") {
        throw new Error("Invalid filename");
    }
    if (buffer.length > MAX_FILE_SIZE) {
        throw new Error("File too large");
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error("Invalid file type");
    }

    const provider = await resolveActiveProvider();
    return provider.upload(buffer, filename, mimeType);
}

export const UPLOAD_MAX_SIZE = MAX_FILE_SIZE;
export const UPLOAD_ALLOWED_MIME = ALLOWED_MIME_TYPES;
