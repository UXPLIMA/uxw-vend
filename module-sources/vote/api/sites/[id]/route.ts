import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/vote/sites/[id] — Update a vote site (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.voteSite.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.url === "string") data.url = body.url;
    if (typeof body.reward === "number") data.reward = body.reward;
    if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
    if (typeof body.order === "number") data.order = body.order;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.voteSite.update({ where: { id }, data });
    return NextResponse.json({ site: updated });
}

// DELETE /api/v1/vote/sites/[id] — Delete a vote site (admin)
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.voteSite.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    await prisma.voteSite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
