import { prisma } from "./db";
import { ModuleUserDataTables } from "@/core/generated/module-registry";

/**
 * GDPR-compliant user data export.
 *
 * Collects everything the platform stores about a user — core tables
 * (profile, sessions, warnings, notification prefs, revisions, activity
 * feed, linked accounts) plus a sweep of module-owned tables declared by
 * each module's `userDataExport` manifest entry.
 *
 * Per the core motto, this file does NOT hardcode any module model names.
 * It reads the generated `ModuleUserDataTables` registry (aggregated from
 * every installed module's manifest at build time), then probes the
 * runtime Prisma client for each entry — uninstalled modules simply
 * contribute nothing to the export without raising errors.
 */

export interface UserDataExport {
    user: unknown;
    activityFeed: unknown[];
    sessions: unknown[];
    warnings: unknown[];
    notificationPrefs: unknown[];
    revisions: unknown[];
    linkedAccounts: unknown[];
    modules: Record<string, unknown>;
}

// Narrow helper — the generated Prisma client isn't fully typed for us
// because we look up models by string, so we use a minimal delegate shape
// and cast once at the boundary. No `any` leaks out of this module.
interface FindManyDelegate {
    findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>;
}

function getDelegate(modelName: string): FindManyDelegate | null {
    const client = prisma as unknown as Record<string, unknown>;
    const delegate = client[modelName];
    if (
        delegate &&
        typeof delegate === "object" &&
        typeof (delegate as { findMany?: unknown }).findMany === "function"
    ) {
        return delegate as FindManyDelegate;
    }
    return null;
}

async function safeFindMany(
    modelName: string,
    where: Record<string, unknown>
): Promise<unknown[]> {
    try {
        const delegate = getDelegate(modelName);
        if (!delegate) return [];
        return await delegate.findMany({ where });
    } catch {
        return [];
    }
}

export async function exportUserData(userId: string): Promise<UserDataExport> {
    // Core user row — strip secret fields.
    const userRow = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            locale: true,
            currency: true,
            emailVerified: true,
            isBanned: true,
            banReason: true,
            bannedAt: true,
            isDeleted: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            role: { select: { name: true, displayName: true } },
        },
    });

    const [
        activityFeed,
        sessions,
        warnings,
        notificationPrefs,
        revisions,
        linkedAccounts,
    ] = await Promise.all([
        safeFindMany("activityFeedItem", { actorId: userId }),
        safeFindMany("userSession", { userId }),
        safeFindMany("userWarning", { userId }),
        safeFindMany("notificationPreference", { userId }),
        safeFindMany("revision", { authorId: userId }),
        safeFindMany("linkedAccount", { userId }),
    ]);

    const modules: Record<string, unknown> = {};
    for (const entry of ModuleUserDataTables) {
        const rows = await safeFindMany(entry.model, { [entry.column]: userId });
        if (rows.length > 0) {
            modules[entry.key] = rows;
        }
    }

    return {
        user: userRow,
        activityFeed,
        sessions,
        warnings,
        notificationPrefs,
        revisions,
        linkedAccounts,
        modules,
    };
}

/**
 * Human-readable README bundled alongside the JSON dump. Kept here so the
 * API route and the admin export share one canonical explanation.
 */
export function buildExportReadme(userId: string, exportedAt: Date): string {
    return `uxwVend personal data export
==============================

User ID: ${userId}
Exported at: ${exportedAt.toISOString()}

Contents
--------
  user-data.json   Structured dump of every row in our database that
                   references your account, grouped by source:

  user             Your profile row (password hash and 2FA secrets
                   are intentionally omitted).
  activityFeed     Public activity feed entries you generated.
  sessions         Login sessions (device, IP, last-active timestamp).
  warnings         Moderation warnings issued against you.
  notificationPrefs
                   Your per-channel notification preferences.
  revisions        Content revisions you authored.
  linkedAccounts   External accounts linked to your profile
                   (OAuth providers, game account bindings, etc.).
  modules          Data owned by installed modules, grouped by module
                   (blog posts, forum topics, orders, tickets, votes,
                   and so on). Only modules that are currently
                   installed on this instance contribute data here.

Your rights
-----------
Under GDPR and similar laws, you may also request permanent
anonymisation of your account ("right to be forgotten") from the
Privacy section of your profile page. That operation keeps your
public contributions (forum topics, blog posts, orders) but removes
your profile, sessions, and direct-message history.

Questions? Contact the site administrator.
`;
}
