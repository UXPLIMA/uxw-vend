import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/**
 * What an admin may change about another account. `username` and `email` used
 * to reach the user row untyped, so either could be written as an object (a
 * 500 from Prisma) or as a string with no ceiling at all.
 */
const adminUpdateUserSchema = z.object({
    roleId: z.string().max(64).optional(),
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
    email: z.string().email().max(254).optional(),
    isBanned: z.boolean().optional(),
    banReason: z.string().max(500).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/users/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { id } = await params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true, email: true, username: true, avatar: true,
                locale: true, currency: true, createdAt: true, updatedAt: true,
                isBanned: true, banReason: true, bannedAt: true,
                emailVerified: true, twoFactorEnabled: true,
                role: { select: { id: true, name: true, displayName: true, color: true, priority: true } },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH /api/v1/users/[id] - Update user (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;

        const parsed = adminUpdateUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 },
            );
        }
        const fields = parsed.data;

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data: Record<string, unknown> = {};

        if (fields.roleId) {
            const role = await prisma.role.findUnique({ where: { id: fields.roleId } });
            if (!role) {
                return NextResponse.json({ error: "Role not found" }, { status: 400 });
            }
            data.roleId = fields.roleId;
        }

        if (fields.username) data.username = fields.username;
        if (fields.email) data.email = fields.email;

        // Ban/unban
        if (fields.isBanned !== undefined) {
            data.isBanned = fields.isBanned;
            data.banReason = fields.isBanned ? (fields.banReason || null) : null;
            data.bannedAt = fields.isBanned ? new Date() : null;
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true, email: true, username: true, avatar: true,
                locale: true, currency: true, createdAt: true, updatedAt: true,
                isBanned: true, banReason: true, bannedAt: true,
                emailVerified: true, twoFactorEnabled: true,
                role: { select: { id: true, name: true, displayName: true, color: true, priority: true } },
            },
        });

        // Audit log
        if (fields.roleId && existing.roleId !== fields.roleId) {
            logActivity({
                userId: session.user.id,
                action: "user.role.change",
                entity: "user",
                entityId: id,
                metadata: {
                    targetUsername: user.username,
                    from: existing.roleId,
                    to: fields.roleId,
                },
            }).catch(() => {});
        }
        if (fields.isBanned !== undefined) {
            logActivity({
                userId: session.user.id,
                action: fields.isBanned ? "user.ban" : "user.unban",
                entity: "user",
                entityId: id,
                metadata: {
                    targetUsername: user.username,
                    reason: fields.isBanned ? (fields.banReason || null) : null,
                },
            }).catch(() => {});
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
