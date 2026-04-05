import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/my-module/items — List items (public)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        prisma.myModuleItem.findMany({
            where: { status: "ACTIVE" },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, username: true, avatar: true } },
            },
        }),
        prisma.myModuleItem.count({ where: { status: "ACTIVE" } }),
    ]);

    return NextResponse.json({
        items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
}

// POST /api/v1/my-module/items — Create item (admin only)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description } = body as { title: string; description?: string };

    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const item = await prisma.myModuleItem.create({
        data: {
            title: title.trim(),
            description: description?.trim() || null,
            userId: session.user.id,
        },
    });

    return NextResponse.json(item, { status: 201 });
}
