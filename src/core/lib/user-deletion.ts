import { prisma } from "./db";

/**
 * "Right to be forgotten" soft-deletion.
 *
 * We do NOT hard-delete the User row because many module tables hold
 * non-nullable FKs to users (forum posts, blog articles, orders). Hard
 * delete would either cascade those away — destroying the public record
 * and breaking audit history — or fail entirely.
 *
 * Instead we anonymise the User row in place and then prune a small set
 * of tables that are explicitly "private and not audit-relevant":
 * sessions, linked accounts, notification preferences, direct messages,
 * and shopping carts. Anything with moderation or public-record value
 * (warnings, activity feed, forum posts, orders, tickets) is kept; its
 * join back to the user now resolves to the anonymised row.
 *
 * This file knows nothing about any specific module — it only touches
 * models exposed by the generated Prisma client and wraps each delete in
 * try/catch so an uninstalled module never breaks the flow.
 */

export interface SoftDeleteResult {
    success: boolean;
    error?: string;
}

interface DeleteManyDelegate {
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

function getDeleteDelegate(modelName: string): DeleteManyDelegate | null {
    const client = prisma as unknown as Record<string, unknown>;
    const delegate = client[modelName];
    if (
        delegate &&
        typeof delegate === "object" &&
        typeof (delegate as { deleteMany?: unknown }).deleteMany === "function"
    ) {
        return delegate as DeleteManyDelegate;
    }
    return null;
}

async function safeDeleteMany(
    modelName: string,
    where: Record<string, unknown>
): Promise<number> {
    try {
        const delegate = getDeleteDelegate(modelName);
        if (!delegate) return 0;
        const res = await delegate.deleteMany({ where });
        return res.count;
    } catch {
        return 0;
    }
}

/**
 * Models hard-deleted because they hold private content with no audit /
 * public-record value. Uninstalled models are silently skipped.
 */
const PRIVATE_MODELS_TO_PURGE: Array<{ model: string; column: string }> = [
    { model: "userSession", column: "userId" },
    { model: "linkedAccount", column: "userId" },
    { model: "notificationPreference", column: "userId" },
    { model: "account", column: "userId" },
    { model: "session", column: "userId" },
    { model: "apiKey", column: "userId" },
    { model: "notification", column: "userId" },
    { model: "cartItem", column: "userId" },
    { model: "message", column: "authorId" },
    { model: "conversationParticipant", column: "userId" },
    { model: "forumTopicLike", column: "userId" },
    { model: "forumPostLike", column: "userId" },
    { model: "suggestionVote", column: "userId" },
];

export async function softDeleteUser(
    userId: string,
    reason?: string
): Promise<SoftDeleteResult> {
    try {
        const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, isDeleted: true },
        });
        if (!existing) {
            return { success: false, error: "User not found" };
        }
        if (existing.isDeleted) {
            return { success: false, error: "User already deleted" };
        }

        // Purge private data first. Each delete is independently
        // wrapped so one missing module can't abort the whole run.
        for (const entry of PRIVATE_MODELS_TO_PURGE) {
            await safeDeleteMany(entry.model, { [entry.column]: userId });
        }

        // Anonymise the User row. Email/username are rewritten to keep
        // the @unique constraints satisfied while being obviously
        // non-identifying. We clear the password so no future login is
        // possible (the row is also isDeleted=true, which login checks).
        const anonEmail = `deleted-${userId}@anonymous.local`;
        const anonUsername = `deleted-user-${userId.slice(0, 8)}`;

        await prisma.user.update({
            where: { id: userId },
            data: {
                email: anonEmail,
                username: anonUsername,
                avatar: null,
                password: "",
                isDeleted: true,
                deletedAt: new Date(),
                banReason: reason || null,
            },
        });

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}
