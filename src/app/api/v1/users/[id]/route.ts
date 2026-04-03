import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

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

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            role: true,
            _count: { select: { orders: true, tickets: true, topics: true, posts: true } },
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
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

    const user = await prisma.user.update({
        where: { id },
        data,
        include: { role: true },
    });

    return NextResponse.json({ user });
}
