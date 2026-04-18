import crypto from "crypto";
import path from "path";
import { prisma } from "@/core/lib/db";
import type { StorageProvider, UploadResult } from "@/core/lib/storage";
import { sanitizeFilename } from "@/core/lib/storage";

declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => Record<string, unknown>;

interface R2Config {
    accountId: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    publicUrl: string;
}

async function loadConfig(): Promise<R2Config | null> {
    const setting = await prisma.setting.findUnique({
        where: { key: "cloudflare_r2_config" },
    });
    if (!setting || !setting.value || typeof setting.value !== "object") {
        return null;
    }
    const v = setting.value as Partial<R2Config>;
    if (!v.accountId || !v.bucket || !v.accessKey || !v.secretKey || !v.publicUrl) {
        return null;
    }
    return v as R2Config;
}

function getR2Sdk() {
    const _require =
        typeof __webpack_require__ === "function"
            ? __non_webpack_require__
            : eval("require");
    return _require("@aws-sdk/client-s3") as {
        S3Client: new (config: Record<string, unknown>) => {
            send: (cmd: unknown) => Promise<unknown>;
        };
        PutObjectCommand: new (input: Record<string, unknown>) => unknown;
    };
}

export const cloudflareR2Provider: StorageProvider = {
    async upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
        const config = await loadConfig();
        if (!config) {
            throw new Error("Cloudflare R2 is not configured");
        }

        const { S3Client, PutObjectCommand } = getR2Sdk();

        const client = new S3Client({
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            region: "auto",
            credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
            },
            forcePathStyle: false,
        });

        const safe = sanitizeFilename(filename);
        const key = `${crypto.randomUUID()}-${safe}`;

        await client.send(
            new PutObjectCommand({
                Bucket: config.bucket,
                Key: key,
                Body: buffer,
                ContentType: mimeType,
            })
        );

        const base = config.publicUrl.replace(/\/+$/, "");
        return {
            url: `${base}/${key}`,
            path: `${config.bucket}/${key}`,
        };
    },
};

export default cloudflareR2Provider;

// Suppress unused import warning — path is needed for sanitization helpers if extended
void path;
