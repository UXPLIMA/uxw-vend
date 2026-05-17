import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.color !== undefined) data.color = body.color;
    if (body.order !== undefined) data.order = body.order;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const department = await prisma.ticketDepartment.update({ where: { id }, data });
    return NextResponse.json({ department });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.ticketDepartment.findUnique({
        where: { id },
        include: { _count: { select: { tickets: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (existing._count.tickets > 0) {
        // Raw Prisma FK errors leaked as 500 before — now return a clear 409.
        return NextResponse.json(
            { error: `Cannot delete: department has ${existing._count.tickets} ticket(s). Move them to another department or close them first.`, code: "department_has_tickets" },
            { status: 409 },
        );
    }

    await prisma.ticketDepartment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
