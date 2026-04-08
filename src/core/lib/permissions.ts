import { prisma } from "./db";

/**
 * Permission System for uxwVend
 *
 * Two layers:
 *
 *  1. Role-level permissions (legacy) — Permission table linked to Role.
 *     Used by hasPermission(userId, "blog.manage") for module-level access.
 *
 *  2. Granular ResourcePermission grants — per-resource and optionally
 *     per-entity allow/deny rules. Used by hasResourcePermission(userId,
 *     "blog.article", "edit", articleId) when fine-grained control is needed.
 *
 * Resolution order (most specific wins; admin role bypasses everything):
 *   1. user-specific grant for the exact resourceId
 *   2. user-specific grant for resource (any id)
 *   3. role grant for the exact resourceId
 *   4. role grant for resource (any id)
 *   5. role's static permissions table (legacy)
 * At each step, allow=false (deny) is final and short-circuits.
 */

export interface PermissionCheck {
    userId: string;
    permission: string;
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
    userId: string,
    permission: string
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: {
                    permissions: true,
                },
            },
        },
    });

    if (!user || !user.role) return false;

    // Admin role has all permissions
    if (user.role.name === "admin") return true;

    return user.role.permissions.some((p: { name: string }) => p.name === permission);
}

/**
 * Check multiple permissions (returns true if user has ANY of them)
 */
export async function hasAnyPermission(
    userId: string,
    permissions: string[]
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.role) return false;
    if (user.role.name === "admin") return true;
    return user.role.permissions.some((p: { name: string }) => permissions.includes(p.name));
}

/**
 * Check multiple permissions (returns true if user has ALL of them)
 */
export async function hasAllPermissions(
    userId: string,
    permissions: string[]
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.role) return false;
    if (user.role.name === "admin") return true;
    const userPerms = user.role.permissions.map((p: { name: string }) => p.name);
    return permissions.every((perm) => userPerms.includes(perm));
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: {
                    permissions: true,
                },
            },
        },
    });

    if (!user || !user.role) return [];

    // Admin role has all permissions
    if (user.role.name === "admin") {
        return ["*"];
    }

    return user.role.permissions.map((p: { name: string }) => p.name);
}

/**
 * Require permission middleware for API routes
 */
export function requirePermission(permission: string) {
    return async (userId: string): Promise<{ allowed: boolean; error?: string }> => {
        const allowed = await hasPermission(userId, permission);
        if (!allowed) {
            return {
                allowed: false,
                error: `Permission denied: ${permission}`,
            };
        }
        return { allowed: true };
    };
}

/**
 * Check if user is admin.
 * Pass sessionRole from JWT to skip the DB query when possible.
 */
export async function isAdmin(userId: string, sessionRole?: string): Promise<boolean> {
    if (sessionRole === "admin") return true;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });

    return user?.role?.name === "admin";
}

/**
 * Check if user is staff (admin or moderator).
 * Pass sessionRole from JWT to skip the DB query when possible.
 */
export async function isStaff(userId: string, sessionRole?: string): Promise<boolean> {
    if (sessionRole === "admin" || sessionRole === "moderator") return true;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });

    return (user?.role?.priority || 0) >= 50;
}

/* ─────────────────── Granular ResourcePermission ─────────────────── */

export type ResourceAction = "view" | "create" | "edit" | "delete" | string;

/**
 * Check if a user has permission to perform an action on a resource.
 * Supports per-entity (resourceId) and resource-wide (no resourceId) checks.
 *
 * Returns true if any allow rule matches, unless a deny rule (allow=false)
 * exists at a more-specific level — denies always win at the same level.
 *
 * Admin role bypasses all checks.
 */
export async function hasResourcePermission(
    userId: string,
    resource: string,
    action: ResourceAction,
    resourceId?: string
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });
    if (!user || !user.role) return false;
    if (user.role.name === "admin") return true;

    // Build a candidate list (most specific first)
    const candidates: { principalType: string; principalId: string; resourceId: string | null }[] = [];

    if (resourceId) {
        candidates.push({ principalType: "user", principalId: userId, resourceId });
    }
    candidates.push({ principalType: "user", principalId: userId, resourceId: null });

    if (resourceId) {
        candidates.push({ principalType: "role", principalId: user.role.id, resourceId });
    }
    candidates.push({ principalType: "role", principalId: user.role.id, resourceId: null });

    // Fetch all rules in one query
    const grants = await prisma.resourcePermission.findMany({
        where: {
            resource,
            action: { in: [action, "*"] },
            OR: [
                { principalType: "user", principalId: userId },
                { principalType: "role", principalId: user.role.id },
            ],
        },
    });

    if (grants.length === 0) return false; // No grant = no access for non-admin

    // Walk the candidate list in priority order
    for (const c of candidates) {
        const match = grants.find(
            (g: { principalType: string; principalId: string; resourceId: string | null; allow: boolean }) =>
                g.principalType === c.principalType &&
                g.principalId === c.principalId &&
                g.resourceId === c.resourceId
        );
        if (match) {
            return match.allow;
        }
    }
    return false;
}

/** Grant or deny a resource permission. */
export async function setResourcePermission(params: {
    resource: string;
    resourceId?: string | null;
    action: ResourceAction;
    principalType: "role" | "user";
    principalId: string;
    allow: boolean;
}): Promise<void> {
    const { resource, resourceId = null, action, principalType, principalId, allow } = params;
    await prisma.resourcePermission.upsert({
        where: {
            resource_resourceId_action_principalType_principalId: {
                resource,
                resourceId: resourceId as string, // Prisma allows null in unique
                action,
                principalType,
                principalId,
            },
        },
        create: { resource, resourceId, action, principalType, principalId, allow },
        update: { allow },
    });
}

/** Remove a resource permission grant. */
export async function removeResourcePermission(params: {
    resource: string;
    resourceId?: string | null;
    action: ResourceAction;
    principalType: "role" | "user";
    principalId: string;
}): Promise<void> {
    await prisma.resourcePermission.deleteMany({
        where: {
            resource: params.resource,
            resourceId: params.resourceId ?? null,
            action: params.action,
            principalType: params.principalType,
            principalId: params.principalId,
        },
    });
}

/** List grants for a principal — used by the admin matrix UI. */
export async function listGrantsForRole(roleId: string) {
    return prisma.resourcePermission.findMany({
        where: { principalType: "role", principalId: roleId },
        orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
}
