import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Generic file upload utility.
 *
 * Backends:
 *  - Local filesystem (default): writes to public/uploads/, returns /uploads/[uuid]-[filename]
 *  - S3-compatible (optional): set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY,
 *    S3_REGION, S3_PUBLIC_URL env vars. Works with AWS S3, Cloudflare R2, MinIO, etc.
 *
 * The @aws-sdk/client-s3 package is loaded via an eval-require pattern so Turbopack
 * does not try to bundle it (it has Node-native dependencies). It is also listed in
 * serverExternalPackages in next.config.ts.
 */

export interface UploadResult {
    url: string;
    path: string;
}

// Maximum file size: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set<string>([
    // Images
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents / data
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/json",
    "text/plain",
    "text/json",
]);

/**
 * Sanitize a filename: strip path traversal, separators, and control chars.
 * Replaces unsafe characters with hyphens. Preserves the extension.
 */
export function sanitizeFilename(filename: string): string {
    // Remove directory separators, path traversal, and control characters.
    let safe = filename
        .replace(/\.\.+/g, "-")
        .replace(/[/\\]/g, "-")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x7f]/g, "-")
        .replace(/[^A-Za-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

    if (!safe || safe === "." || safe === "..") {
        safe = "file";
    }

    // Cap length to avoid path-length issues
    if (safe.length > 120) {
        const ext = path.extname(safe);
        const base = safe.slice(0, 120 - ext.length);
        safe = base + ext;
    }

    return safe;
}

interface S3Env {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
    publicUrl: string;
}

function getS3Env(): S3Env | null {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    const region = process.env.S3_REGION;
    const publicUrl = process.env.S3_PUBLIC_URL;

    if (!endpoint || !bucket || !accessKey || !secretKey || !region || !publicUrl) {
        return null;
    }

    return { endpoint, bucket, accessKey, secretKey, region, publicUrl };
}

/**
 * Upload a file. Returns a public URL and the storage path.
 *
 * @throws Error "File too large" — over 50 MB
 * @throws Error "Invalid file type" — MIME type not allowed
 * @throws Error "Invalid filename" — empty filename
 */
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

    const safeFilename = sanitizeFilename(filename);
    const uuid = crypto.randomUUID();
    const key = `${uuid}-${safeFilename}`;

    const s3 = getS3Env();
    if (s3) {
        return uploadToS3(buffer, key, mimeType, s3);
    }

    return uploadToLocal(buffer, key);
}

async function uploadToLocal(buffer: Buffer, key: string): Promise<UploadResult> {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, key);

    // Safety: ensure resolved path stays inside the uploads directory
    const resolvedDir = path.resolve(uploadsDir);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
        throw new Error("Invalid filename");
    }

    await fs.writeFile(filePath, buffer);

    return {
        url: `/uploads/${key}`,
        path: `public/uploads/${key}`,
    };
}

// Eval-require pattern (Turbopack-compatible) — see next.config.ts serverExternalPackages.
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => Record<string, unknown>;

async function uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
    env: S3Env,
): Promise<UploadResult> {
    const _require =
        typeof __webpack_require__ === "function"
            ? __non_webpack_require__
            : eval("require");
    const { S3Client, PutObjectCommand } = _require("@aws-sdk/client-s3") as {
        S3Client: new (config: Record<string, unknown>) => {
            send: (cmd: unknown) => Promise<unknown>;
        };
        PutObjectCommand: new (input: Record<string, unknown>) => unknown;
    };

    const client = new S3Client({
        endpoint: env.endpoint,
        region: env.region,
        credentials: {
            accessKeyId: env.accessKey,
            secretAccessKey: env.secretKey,
        },
        forcePathStyle: true,
    });

    const cmd = new PutObjectCommand({
        Bucket: env.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    });

    await client.send(cmd);

    const base = env.publicUrl.replace(/\/+$/, "");
    return {
        url: `${base}/${key}`,
        path: `${env.bucket}/${key}`,
    };
}
