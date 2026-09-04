import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { suggestionUpdateSchema } from "../../lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/suggestions/[id] - Update status (admin) or content (author)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const suggestion = await prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = suggestionUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;

    const adminCheck = await isAdmin(session.user.id);
    const data: Record<string, unknown> = {};

    // Admin can change status
    if (adminCheck && fields.status) data.status = fields.status;
    // Author can edit content
    if (suggestion.authorId === session.user.id) {
        if (fields.title) data.title = fields.title;
        if (fields.content) data.content = fields.content;
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    // Snapshot the previous state before update
    const { recordRevision } = await import("@/core/sdk/server");
    await recordRevision("suggestions.suggestion", id, suggestion, "update", session.user.id);

    const updated = await prisma.suggestion.update({ where: { id }, data });

    const { doActionAsync } = await import("@/core/sdk");
    await doActionAsync("suggestions.suggestion.updated", updated);
    if (data.status && data.status !== suggestion.status) {
        await doActionAsync("suggestions.suggestion.statusChanged", {
            suggestion: updated,
            previousStatus: suggestion.status,
        });
    }

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

    // Snapshot the deleted suggestion for potential restore
    const { recordRevision } = await import("@/core/sdk/server");
    await recordRevision("suggestions.suggestion", id, suggestion, "delete", session.user.id);

    await prisma.suggestion.delete({ where: { id } });

    const { doActionAsync } = await import("@/core/sdk");
    await doActionAsync("suggestions.suggestion.deleted", suggestion);

    return NextResponse.json({ message: "Deleted" });
}
