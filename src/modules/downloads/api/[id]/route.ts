import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Increment download count and return file URL
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const download = await prisma.download.findUnique({ where: { id } });
    if (!download) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.download.update({ where: { id }, data: { downloads: { increment: 1 } } });
    return NextResponse.json({ url: download.fileUrl });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const download = await prisma.download.update({ where: { id }, data: body });
    return NextResponse.json({ download });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.download.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
