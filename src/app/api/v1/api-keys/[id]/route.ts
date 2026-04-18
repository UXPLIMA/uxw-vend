import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { id } = await params;
        const key = await prisma.apiKey.findUnique({ where: { id }, select: { id: true, name: true, keyPrefix: true } });
        if (!key) return NextResponse.json({ error: "API key not found" }, { status: 404 });
        await prisma.apiKey.delete({ where: { id } });

        logActivity({
            userId: session.user.id,
            action: "apikey.revoke",
            entity: "apiKey",
            entityId: key.id,
            metadata: { name: key.name, keyPrefix: key.keyPrefix },
        }).catch(() => {});

        return NextResponse.json({ message: "Deleted" });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
