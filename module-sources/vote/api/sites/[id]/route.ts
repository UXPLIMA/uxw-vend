import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { voteSiteUpdateSchema } from "../../../lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/vote/sites/[id] - Update a vote site (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.voteSite.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = voteSiteUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;

    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.url !== undefined) data.url = fields.url;
    if (fields.reward !== undefined) data.reward = fields.reward;
    if (fields.icon !== undefined) data.icon = fields.icon;
    if (fields.order !== undefined) data.order = fields.order;
    if (fields.isActive !== undefined) data.isActive = fields.isActive;

    const updated = await prisma.voteSite.update({ where: { id }, data });
    return NextResponse.json({ site: updated });
}

// DELETE /api/v1/vote/sites/[id] - Delete a vote site (admin)
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
