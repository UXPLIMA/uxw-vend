import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/suggestions/[id] - Update status (admin) or content (author)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const suggestion = await prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const adminCheck = await isAdmin(session.user.id);
    const data: Record<string, unknown> = {};

    // Admin can change status
    if (adminCheck && body.status) data.status = body.status;
    // Author can edit content
    if (suggestion.authorId === session.user.id) {
        if (body.title) data.title = body.title;
        if (body.content) data.content = body.content;
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const updated = await prisma.suggestion.update({ where: { id }, data });
    return NextResponse.json({ suggestion: updated });
}

// DELETE /api/v1/suggestions/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const suggestion = await prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const adminCheck = await isAdmin(session.user.id);
    if (suggestion.authorId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.suggestion.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
