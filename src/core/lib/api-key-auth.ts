import { prisma } from "@/core/lib/db";
import { log } from "@/core/lib/logger";
import bcrypt from "bcryptjs";

type ValidateResult =
    | { valid: true; keyId: string; userId: string; permissions: string[] }
    | { valid: false; error: string; status: 401 | 403 };

/** What the key's standing depends on, as the row holds it. */
export interface KeyOwner {
    isBanned: boolean;
    isDeleted: boolean;
    roleName: string | null;
}

/**
 * Whether the account behind a key still stands behind it.
 *
 * A session is re-checked against the database every minute and ends when the
 * account is banned or deleted. A key was compared against its own hash and
 * nothing else, so it kept working through all three of those - measured
 * against a production build, an admin's key drove the scheduler after the
 * owner was banned, demoted and marked deleted. A hard delete does cascade the
 * row away; it is the reversible states that carried on, and those are the
 * ones an operator reaches for first.
 *
 * Being an admin is part of the answer because being an admin is what it took
 * to create the key. A key that outlives the role that issued it is a
 * permission somebody believes they revoked.
 */
export function ownerStillAuthorises(owner: KeyOwner | null): boolean {
    if (!owner) return false;
    if (owner.isBanned || owner.isDeleted) return false;
    return owner.roleName === "admin";
}

/**
 * Validate an API key from x-api-key header.
 * Keys are stored as bcrypt hashes - lookup by prefix, verify with bcrypt.compare.
 * Optionally check for a required permission.
 */
export async function validateApiKey(rawKey: string, requiredPermission?: string): Promise<ValidateResult> {
    const prefix = rawKey.slice(0, 12);

    // The owner rides along on the same query. A second lookup would be a
    // second round trip on a path that already does a bcrypt round.
    const candidates = await prisma.apiKey.findMany({
        where: { keyPrefix: prefix, isActive: true },
        include: {
            user: {
                select: {
                    isBanned: true,
                    isDeleted: true,
                    role: { select: { name: true } },
                },
            },
        },
    });

    if (candidates.length === 0) {
        return { valid: false, error: "Invalid API key", status: 401 };
    }

    for (const candidate of candidates) {
        // Check expiry
        if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;

        const match = await bcrypt.compare(rawKey, candidate.keyHash);
        if (!match) continue;

        const owner = candidate.user
            ? {
                  isBanned: candidate.user.isBanned,
                  isDeleted: candidate.user.isDeleted,
                  roleName: candidate.user.role?.name ?? null,
              }
            // A key with no owner row is a key for nobody, which is a refusal
            // rather than a crash on a path an integration calls in a loop.
            : null;

        // The key is genuine; whether it still means anything is a separate
        // question. Refused as invalid rather than with a reason: the caller
        // is a machine holding a bearer token, and naming the owner's state
        // would answer a question about an account to whoever holds it. The
        // reason goes to the log, where the operator debugging their
        // integration can read it.
        if (!ownerStillAuthorises(owner)) {
            log.warn("[api-key] refused a key whose owner no longer authorises it", {
                keyId: candidate.id,
                userId: candidate.userId,
                banned: owner?.isBanned ?? null,
                deleted: owner?.isDeleted ?? null,
                role: owner?.roleName ?? null,
            });
            return { valid: false, error: "Invalid API key", status: 401 };
        }

        // Key matched - update lastUsedAt
        await prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });

        // Check permission
        if (requiredPermission && !candidate.permissions.includes(requiredPermission) && !candidate.permissions.includes("*")) {
            return { valid: false, error: `API key lacks ${requiredPermission} permission`, status: 403 };
        }

        return { valid: true, keyId: candidate.id, userId: candidate.userId, permissions: candidate.permissions };
    }

    return { valid: false, error: "Invalid API key", status: 401 };
}
