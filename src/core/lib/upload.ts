import { prisma } from "./db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Upload configuration and file handling
 * Reads provider settings from the database.
 * Currently supports local storage; S3 and Cloudflare R2 are future extensions.
 */

export interface UploadConfig {
    provider: "local" | "s3" | "cloudflare";
    maxSizeMB: number;
    localDir: string;
    s3?: {
        bucket: string;
        region: string;
        endpoint?: string;
    };
    cloudflare?: {
        accountId: string;
    };
}

const UPLOAD_SETTING_KEYS = [
    "upload_provider",
    "upload_max_size_mb",
    "upload_local_dir",
    "upload_s3_bucket",
    "upload_s3_region",
    "upload_s3_endpoint",
    "upload_s3_key",
    "upload_s3_secret",
    "upload_cloudflare_account_id",
    "upload_cloudflare_token",
] as const;

/**
 * All upload-related setting keys, for use in admin settings UI
 */
export { UPLOAD_SETTING_KEYS };

/**
 * Read upload configuration from database settings
 */
export async function getUploadConfig(): Promise<UploadConfig> {
    const settings = await prisma.setting.findMany({
        where: { key: { in: [...UPLOAD_SETTING_KEYS] } },
    });

    const map = new Map<string, string>();
    for (const s of settings) {
        map.set(s.key, typeof s.value === "string" ? s.value : String(s.value));
    }

    const provider = (map.get("upload_provider") || "local") as UploadConfig["provider"];
    const maxSizeMB = Number(map.get("upload_max_size_mb")) || 10;
    const localDir = map.get("upload_local_dir") || "public/uploads";

    const config: UploadConfig = { provider, maxSizeMB, localDir };

    if (provider === "s3") {
        config.s3 = {
            bucket: map.get("upload_s3_bucket") || "",
            region: map.get("upload_s3_region") || "us-east-1",
            endpoint: map.get("upload_s3_endpoint") || undefined,
        };
    }

    if (provider === "cloudflare") {
        config.cloudflare = {
            accountId: map.get("upload_cloudflare_account_id") || "",
        };
    }

    return config;
}

/**
 * Upload a file using the configured provider
 * Returns the public URL path for the uploaded file
 */
export async function uploadFile(
    file: Buffer,
    filename: string,
    subdirectory = ""
): Promise<string> {
    const config = await getUploadConfig();

    // Validate file size
    const maxBytes = config.maxSizeMB * 1024 * 1024;
    if (file.length > maxBytes) {
        throw new Error(`File exceeds maximum size of ${config.maxSizeMB}MB`);
    }

    // Sanitize filename: keep extension, use random prefix
    const ext = path.extname(filename).toLowerCase();
    const safeName = `${crypto.randomBytes(12).toString("hex")}${ext}`;

    switch (config.provider) {
        case "local":
            return uploadLocal(file, safeName, subdirectory, config.localDir);
        case "s3":
            throw new Error("S3 upload not yet implemented. Install @aws-sdk/client-s3 and configure credentials.");
        case "cloudflare":
            throw new Error("Cloudflare R2 upload not yet implemented. Configure Cloudflare credentials.");
        default:
            return uploadLocal(file, safeName, subdirectory, config.localDir);
    }
}

/**
 * Local filesystem upload
 */
async function uploadLocal(
    file: Buffer,
    filename: string,
    subdirectory: string,
    localDir: string
): Promise<string> {
    const uploadDir = path.join(process.cwd(), localDir, subdirectory);
    await fs.mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, file);

    // Return URL path relative to public/
    const publicPrefix = localDir.startsWith("public/") ? localDir.slice("public/".length) : localDir;
    return `/${publicPrefix}${subdirectory ? `/${subdirectory}` : ""}/${filename}`;
}

/**
 * Delete an uploaded file by its URL path
 */
export async function deleteFile(urlPath: string): Promise<void> {
    const config = await getUploadConfig();

    if (config.provider === "local") {
        const publicPrefix = config.localDir.startsWith("public/") ? config.localDir.slice("public/".length) : config.localDir;
        if (!urlPath.startsWith(`/${publicPrefix}/`)) return;

        const relativePath = urlPath.slice(1); // remove leading /
        const filepath = path.join(process.cwd(), "public", relativePath);

        // Ensure the resolved path is inside the upload directory
        const resolvedDir = path.resolve(process.cwd(), config.localDir);
        const resolvedFile = path.resolve(filepath);
        if (!resolvedFile.startsWith(resolvedDir + path.sep)) return;

        await fs.unlink(filepath).catch(() => {});
    }
    // S3 and Cloudflare deletion can be added later
}
