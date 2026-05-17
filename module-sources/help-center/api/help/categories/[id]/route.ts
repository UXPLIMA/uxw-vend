import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/help/categories/[id] — Update category (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.helpCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.slug === "string") data.slug = body.slug;
    if (typeof body.description === "string" || body.description === null) data.description = body.description;
    if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
    if (typeof body.order === "number") data.order = body.order;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.helpCategory.update({ where: { id }, data });
    return NextResponse.json({ category: updated });
}

// DELETE /api/v1/help/categories/[id] — Delete category (admin).
// Refuses if the category still has articles.
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.helpCategory.findUnique({
        where: { id },
        include: { _count: { select: { articles: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    if (existing._count.articles > 0) {
        return NextResponse.json(
            { error: `Cannot delete: category has ${existing._count.articles} article(s). Delete them first or set inactive.`, code: "category_has_articles" },
            { status: 409 },
        );
    }

    await prisma.helpCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
