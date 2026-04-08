import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

/**
 * GET /api/v1/media — list media items.
 * Query: ?page=1&perPage=24&search=&type=image
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(searchParams.get("perPage") || "24"), 100);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type")?.trim() || "";

    const where: Record<string, unknown> = {};
    if (search) where.filename = { contains: search, mode: "insensitive" };
    if (type === "image") where.mimeType = { startsWith: "image/" };
    else if (type === "document") where.mimeType = { startsWith: "application/" };

    const [items, total] = await Promise.all([
        prisma.mediaItem.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
            include: { uploadedBy: { select: { username: true } } },
        }),
        prisma.mediaItem.count({ where }),
    ]);

    return NextResponse.json({
        items,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
    });
}
