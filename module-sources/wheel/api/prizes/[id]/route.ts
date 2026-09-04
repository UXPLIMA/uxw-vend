import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { wheelPrizeUpdateSchema } from "../../../lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH - Admin: update prize
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = wheelPrizeUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;

    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.type !== undefined) data.type = fields.type;
    if (fields.value !== undefined) data.value = fields.value;
    if (fields.color !== undefined) data.color = fields.color;
    if (fields.probability !== undefined) data.probability = fields.probability;
    if (fields.order !== undefined) data.order = fields.order;
    if (fields.isActive !== undefined) data.isActive = fields.isActive;

    const prize = await prisma.wheelPrize.update({ where: { id }, data });
    return NextResponse.json({ prize });
}

// DELETE - Admin: delete prize
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.wheelPrize.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
