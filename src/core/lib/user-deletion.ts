import { prisma } from "./db";
import { ModuleUserDataTables } from "@/core/generated/module-registry";

/**
 * "Right to be forgotten" soft-deletion.
 *
 * We do NOT hard-delete the User row because many module tables hold
 * non-nullable FKs to users (forum posts, blog articles, orders). Hard
 * delete would either cascade those away - destroying the public record
 * and breaking audit history - or fail entirely.
 *
 * Instead we anonymise the User row in place and then prune the tables
 * that are private and not audit-relevant: sessions, notification
 * preferences, direct messages, and whatever each module says of its own
 * tables. Anything with moderation or public-record value (warnings,
 * activity feed, forum posts, orders, tickets) is kept; its join back to
 * the user now resolves to the anonymised row.
 *
 * The claim that this file "knows nothing about any specific module" used
 * to be written here while the purge list named `linkedAccount`,
 * `notification`, `cartItem`, `forumTopicLike`, `forumPostLike` and
 * `suggestionVote` - six tables belonging to five modules. A module core
 * had never heard of could not have its private data erased at all, and
 * the six that could were erased because someone had edited core. Now
 * every module states the disposition of each table it already declares
 * for the data export, and core reads the registry.
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
 * Core models hard-deleted because they hold private content with no
 * audit or public-record value. Module tables are not listed here: they
 * come from the registry below.
 */
const CORE_MODELS_TO_PURGE: Array<{ model: string; column: string }> = [
    { model: "userSession", column: "userId" },
    { model: "notificationPreference", column: "userId" },
    { model: "account", column: "userId" },
    { model: "session", column: "userId" },
    { model: "apiKey", column: "userId" },
    { model: "message", column: "authorId" },
    { model: "conversationParticipant", column: "userId" },
];

/**
 * Module tables to purge, as their own manifests declare them. A table a
 * module exports with `"erasure": "purge"` is deleted; one marked
 * "retain", or one that says nothing, is kept and re-joins the anonymised
 * row. Uninstalled models are silently skipped, so the registry going
 * stale never breaks the flow.
 */
export function modulePurgeTargets(
    tables: ReadonlyArray<{ model: string; column: string; erasure?: string }> = ModuleUserDataTables,
): Array<{ model: string; column: string }> {
    const seen = new Set<string>();
    const out: Array<{ model: string; column: string }> = [];
    for (const table of tables) {
        if (table.erasure !== "purge") continue;
        // Two keys can name one table (the store lists several routes twice
        // over); deleting it once is enough.
        const id = `${table.model}:${table.column}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ model: table.model, column: table.column });
    }
    return out;
}

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
        for (const entry of [...CORE_MODELS_TO_PURGE, ...modulePurgeTargets()]) {
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
