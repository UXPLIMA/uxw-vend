import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

type RouteParams = { params: Promise<{ id: string }> };

async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

// PATCH /api/v1/slider/[id] - Update a slide (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const existing = await prisma.sliderItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Slide not found" }, { status: 404 });

    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const data: Record<string, unknown> = {};
    // Only fields the request actually carried, so a partial edit does not
    // blank the rest of the slide.
    if (typeof body.title === "string" || body.title === null) data.title = body.title || null;
    if (typeof body.subtitle === "string" || body.subtitle === null) data.subtitle = body.subtitle || null;
    if (typeof body.image === "string" && body.image.length > 0) data.image = body.image;
    if (typeof body.link === "string" || body.link === null) data.link = body.link || null;
    if (typeof body.order === "number") data.order = body.order;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const item = await prisma.sliderItem.update({ where: { id }, data });
    return NextResponse.json({ item });
}

// DELETE /api/v1/slider/[id] - Delete a slide (admin)
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { id } = await params;
    const existing = await prisma.sliderItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Slide not found" }, { status: 404 });

    await prisma.sliderItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
