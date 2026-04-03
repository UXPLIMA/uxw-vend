import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const members = await prisma.staffMember.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { user: { select: { username: true, avatar: true } } },
    });
    return NextResponse.json({ members });
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
