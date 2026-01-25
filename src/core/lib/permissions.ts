import { prisma } from "./db";

/**
 * Permission System for uxwVend
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

    if (!user) return false;

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
    for (const permission of permissions) {
        if (await hasPermission(userId, permission)) {
            return true;
        }
    }
    return false;
}

/**
 * Check multiple permissions (returns true if user has ALL of them)
 */
export async function hasAllPermissions(
    userId: string,
    permissions: string[]
): Promise<boolean> {
    for (const permission of permissions) {
        if (!(await hasPermission(userId, permission))) {
            return false;
        }
    }
    return true;
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

    if (!user) return [];

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
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });

    return user?.role.name === "admin";
}

/**
 * Check if user is staff (admin or moderator)
 */
export async function isStaff(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });

    return ["admin", "moderator", "staff"].includes(user?.role.name || "");
}
