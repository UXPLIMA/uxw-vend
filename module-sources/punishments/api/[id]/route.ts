import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const data: Record<string, unknown> = {};
    if (body.reason !== undefined) data.reason = body.reason;
    if (body.active !== undefined) data.active = body.active;
    if (body.duration !== undefined) data.duration = body.duration;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const punishment = await prisma.punishment.update({ where: { id }, data });

    // If the punishment was revoked (active → false), fire revoke hook + feed
    if (body.active === false) {
        const { doActionAsync } = await import("@/core/sdk");
        await doActionAsync("punishments.punishment.revoked", {
            punishmentId: punishment.id,
            playerName: punishment.playerName,
            type: punishment.type,
            revokedBy: session.user.id,
        });
        await prisma.activityFeedItem.create({
            data: {
                type: "punishments.punishment.revoked",
                actorId: session.user.id,
                title: `${punishment.type} revoked for ${punishment.playerName}`,
                icon: "AlertTriangle",
                isPublic: false,
            },
        }).catch(() => {});
    }

    return NextResponse.json({ punishment });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const punishment = await prisma.punishment.findUnique({ where: { id } });
    await prisma.punishment.delete({ where: { id } });

    if (punishment) {
        const { doActionAsync } = await import("@/core/sdk");
        await doActionAsync("punishments.punishment.revoked", {
            punishmentId: punishment.id,
            playerName: punishment.playerName,
            type: punishment.type,
            revokedBy: session.user.id,
        });
        await prisma.activityFeedItem.create({
            data: {
                type: "punishments.punishment.revoked",
                actorId: session.user.id,
                title: `${punishment.type} revoked for ${punishment.playerName}`,
                icon: "AlertTriangle",
                isPublic: false,
            },
        }).catch(() => {});
    }

    return NextResponse.json({ message: "Deleted" });
}
