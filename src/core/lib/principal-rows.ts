import { prisma } from "./db";

/**
 * Rows that name a person or a role without a foreign key.
 *
 * Almost everything that belongs to a user is joined to `User` by a relation,
 * so Prisma cascades it and both the export and the erasure sweep find it by
 * walking the schema. Two stores do not work that way, and both were missed
 * because nothing about them looks like a user column:
 *
 *   ResourcePermission  a polymorphic grant: `principalType` says "role" or
 *                       "user" and `principalId` holds the id. There is no
 *                       relation to either table, so deleting a role left its
 *                       grants behind and erasing a user left theirs, listed
 *                       in the admin panel as a bare cuid because the name
 *                       lookup no longer resolved.
 *
 *   Setting            `dashboard_layout:<userId>` is one row per admin,
 *                       keyed by embedding the id in a string. The user's
 *                       notification preferences next to it are a real table
 *                       and were purged on erasure; this one was not.
 *
 * Both sweeps live here so the delete paths and the export read one list
 * rather than each remembering. A grant against a deleted principal is inert
 * - a cuid is never reissued, so no new role or account inherits one - which
 * is why this is a hygiene and retention fix rather than a privilege one.
 */

/** The `Setting.key` holding one admin's dashboard arrangement. */
export function dashboardLayoutKey(userId: string): string {
    return `dashboard_layout:${userId}`;
}

/**
 * Everything keyed to one user through a string rather than a relation.
 * Returns how many rows went, for the caller's log.
 */
export async function purgeUserPrincipalRows(userId: string): Promise<number> {
    let removed = 0;
    try {
        const grants = await prisma.resourcePermission.deleteMany({
            where: { principalType: "user", principalId: userId },
        });
        removed += grants.count;
    } catch { /* non-fatal: the erasure itself matters more */ }
    try {
        const layout = await prisma.setting.deleteMany({
            where: { key: dashboardLayoutKey(userId) },
        });
        removed += layout.count;
    } catch { /* non-fatal */ }
    return removed;
}

/** The grants written against a role, which its own delete does not cascade. */
export async function purgeRolePrincipalRows(roleId: string): Promise<number> {
    try {
        const grants = await prisma.resourcePermission.deleteMany({
            where: { principalType: "role", principalId: roleId },
        });
        return grants.count;
    } catch {
        return 0;
    }
}
