import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH - Admin: update status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const { status, adminNote } = await request.json();

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (adminNote !== undefined) data.adminNote = adminNote;

    const application = await prisma.staffApplication.update({ where: { id }, data });
    return NextResponse.json({ application });
}

// DELETE
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const app = await prisma.staffApplication.findUnique({ where: { id } });
    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const adminCheck = await isAdmin(session.user.id);
    if (app.userId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.staffApplication.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
