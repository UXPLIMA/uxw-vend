import { prisma } from "@/core/lib/db";
import bcrypt from "bcryptjs";

type ValidateResult =
    | { valid: true; keyId: string; userId: string; permissions: string[] }
    | { valid: false; error: string; status: 401 | 403 };

/**
 * Validate an API key from x-api-key header.
 * Keys are stored as bcrypt hashes — lookup by prefix, verify with bcrypt.compare.
 * Optionally check for a required permission.
 */
export async function validateApiKey(rawKey: string, requiredPermission?: string): Promise<ValidateResult> {
    const prefix = rawKey.slice(0, 12);

    const candidates = await prisma.apiKey.findMany({
        where: { keyPrefix: prefix, isActive: true },
    });

    if (candidates.length === 0) {
        return { valid: false, error: "Invalid API key", status: 401 };
    }

    for (const candidate of candidates) {
        // Check expiry
        if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;

        const match = await bcrypt.compare(rawKey, candidate.keyHash);
        if (!match) continue;

        // Key matched — update lastUsedAt
        await prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });

        // Check permission
        if (requiredPermission && !candidate.permissions.includes(requiredPermission) && !candidate.permissions.includes("*")) {
            return { valid: false, error: `API key lacks ${requiredPermission} permission`, status: 403 };
        }

        return { valid: true, keyId: candidate.id, userId: candidate.userId, permissions: candidate.permissions };
    }

    return { valid: false, error: "Invalid API key", status: 401 };
}
