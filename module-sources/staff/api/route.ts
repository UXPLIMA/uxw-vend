import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const onlineOnly = searchParams.get("online") === "1";

    const members = await prisma.staffMember.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    if (!onlineOnly) {
        return NextResponse.json({ members });
    }

    // Filter to staff with an unexpired, non-revoked session → considered "online"
    const linkedUserIds = members.map((m) => m.user?.id).filter((id): id is string => !!id);
    if (linkedUserIds.length === 0) {
        return NextResponse.json({ members: [] });
    }
    const now = new Date();
    const activeSessions = await prisma.userSession.findMany({
        where: {
            userId: { in: linkedUserIds },
            isRevoked: false,
            expiresAt: { gt: now },
        },
        select: { userId: true },
        distinct: ["userId"],
    });
    const onlineUserIds = new Set(activeSessions.map((s) => s.userId));
    const onlineMembers = members.filter((m) => m.user?.id && onlineUserIds.has(m.user.id));
    return NextResponse.json({ members: onlineMembers });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, role, avatar, userId, order } = await request.json();
    if (!name || !role) return NextResponse.json({ error: "Name and role required" }, { status: 400 });

    const member = await prisma.staffMember.create({
        data: { name, role, avatar: avatar || null, userId: userId || null, order: order || 0 },
    });
    return NextResponse.json({ member }, { status: 201 });
}
