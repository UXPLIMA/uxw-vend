import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";

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
        const body = await request.json();

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data: Record<string, unknown> = {};

        if (body.roleId) {
            const role = await prisma.role.findUnique({ where: { id: body.roleId } });
            if (!role) {
                return NextResponse.json({ error: "Role not found" }, { status: 400 });
            }
            data.roleId = body.roleId;
        }

        if (body.username) data.username = body.username;
        if (body.email) data.email = body.email;

        // Ban/unban
        if (body.isBanned !== undefined) {
            data.isBanned = body.isBanned;
            data.banReason = body.isBanned ? (body.banReason || null) : null;
            data.bannedAt = body.isBanned ? new Date() : null;
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
        if (body.roleId && existing.roleId !== body.roleId) {
            logActivity({
                userId: session.user.id,
                action: "user.role.change",
                entity: "user",
                entityId: id,
                metadata: {
                    targetUsername: user.username,
                    from: existing.roleId,
                    to: body.roleId,
                },
            }).catch(() => {});
        }
        if (body.isBanned !== undefined) {
            logActivity({
                userId: session.user.id,
                action: body.isBanned ? "user.ban" : "user.unban",
                entity: "user",
                entityId: id,
                metadata: {
                    targetUsername: user.username,
                    reason: body.isBanned ? (body.banReason || null) : null,
                },
            }).catch(() => {});
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
