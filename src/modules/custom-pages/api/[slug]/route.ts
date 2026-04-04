import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ slug: string }> };

// GET /api/v1/custom-pages/[slug] - Public
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;
    const page = await prisma.customPage.findFirst({
        where: { OR: [{ slug }, { id: slug }], isActive: true },
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page });
}

// PATCH /api/v1/custom-pages/[slug] - Admin
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const body = await request.json();
    const page = await prisma.customPage.findFirst({ where: { OR: [{ slug }, { id: slug }] } });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.order !== undefined) data.order = body.order;

    const updated = await prisma.customPage.update({ where: { id: page.id }, data });
    return NextResponse.json({ page: updated });
}

// DELETE /api/v1/custom-pages/[slug] - Admin
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const page = await prisma.customPage.findFirst({ where: { OR: [{ slug }, { id: slug }] } });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    await prisma.customPage.delete({ where: { id: page.id } });
    return NextResponse.json({ message: "Page deleted" });
}
