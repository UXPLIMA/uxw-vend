import { prisma } from "./db";

/**
 * Permission system.
 *
 * Two layers, both bypassed by the admin role:
 *   1. Role-level permissions (Permission table joined via Role) for
 *      module-wide access, e.g. hasPermission(userId, "blog.manage").
 *   2. ResourcePermission grants for per-resource or per-entity allow/deny,
 *      e.g. hasResourcePermission(userId, "blog.article", "edit", articleId).
 *
 * Resource grants resolve most-specific-first: user+resourceId → user+resource
 * → role+resourceId → role+resource → legacy role permissions. Any matching
 * deny short-circuits.
 */

export interface PermissionCheck {
    userId: string;
    permission: string;
}

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
    if (user.role.name === "admin") return true;
    return user.role.permissions.some((p: { name: string }) => p.name === permission);
}

/** True when the user has at least one of the listed permissions. */
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

/** True only when the user has every listed permission. */
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

/** Returns `["*"]` for admin (matches all permissions). */
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
    if (user.role.name === "admin") return ["*"];
    return user.role.permissions.map((p: { name: string }) => p.name);
}

/** Adapter for API routes that gate on a single permission. */
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

/** Pass sessionRole from JWT to skip the DB query. */
export async function isAdmin(userId: string, sessionRole?: string): Promise<boolean> {
    if (sessionRole === "admin") return true;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });

    return user?.role?.name === "admin";
}

/** Staff = admin or moderator (role priority ≥ 50). Skip DB via sessionRole. */
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
 * Allow-by-rule check with most-specific-wins resolution; admins bypass.
 * Passing `resourceId` checks per-entity grants then falls back to
 * resource-wide. A deny at any matched level short-circuits to false.
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

    const candidates: { principalType: string; principalId: string; resourceId: string | null }[] = [];

    if (resourceId) {
        candidates.push({ principalType: "user", principalId: userId, resourceId });
    }
    candidates.push({ principalType: "user", principalId: userId, resourceId: null });

    if (resourceId) {
        candidates.push({ principalType: "role", principalId: user.role.id, resourceId });
    }
    candidates.push({ principalType: "role", principalId: user.role.id, resourceId: null });

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

    if (grants.length === 0) return false;

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
                resourceId: resourceId as string,
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
