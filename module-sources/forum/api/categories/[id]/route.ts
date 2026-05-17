import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/forum/categories/[id] — Update a category (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.forumCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.slug === "string") data.slug = body.slug;
    if (typeof body.description === "string" || body.description === null) data.description = body.description;
    if (typeof body.color === "string" || body.color === null) data.color = body.color;
    if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
    if (typeof body.order === "number") data.order = body.order;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.forumCategory.update({ where: { id }, data });
    return NextResponse.json({ category: updated });
}

// DELETE /api/v1/forum/categories/[id] — Delete a category (admin).
// Refuses if the category still has topics — admin must move/delete them
// first or set isActive=false to hide instead.
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.forumCategory.findUnique({
        where: { id },
        include: { _count: { select: { topics: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    if (existing._count.topics > 0) {
        return NextResponse.json(
            { error: `Cannot delete: category has ${existing._count.topics} topic(s). Move or delete them first, or set the category inactive instead.`, code: "category_has_topics" },
            { status: 409 },
        );
    }

    await prisma.forumCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
