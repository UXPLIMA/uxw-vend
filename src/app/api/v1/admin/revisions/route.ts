import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

/**
 * GET /api/v1/admin/revisions
 * List all revisions across every resource, newest first, paginated.
 * Optional filters: ?resource=blog.article&resourceId=xxx&page=1
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource") || undefined;
    const resourceId = searchParams.get("resourceId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const perPage = 50;

    const where = {
        ...(resource ? { resource } : {}),
        ...(resourceId ? { resourceId } : {}),
    };

    const [revisions, total, distinctResources] = await Promise.all([
        prisma.revision.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
                author: { select: { id: true, username: true } },
            },
        }),
        prisma.revision.count({ where }),
        prisma.revision.findMany({
            distinct: ["resource"],
            select: { resource: true },
            orderBy: { resource: "asc" },
        }),
    ]);

    return NextResponse.json({
        revisions,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / perPage)),
        resources: distinctResources.map((r) => r.resource),
    });
}
