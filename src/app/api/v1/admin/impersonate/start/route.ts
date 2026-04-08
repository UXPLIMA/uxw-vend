import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";

/**
 * POST /api/v1/admin/impersonate/start
 * Body: { userId: string }
 *
 * Marks the admin's next JWT update as an impersonation of the target user.
 * The client must follow up with `update({ impersonate: userId })` from
 * `useSession()` so Auth.js rewrites the JWT claims.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hard security guard: only real admins may start impersonation, and
    // a session already in impersonation mode cannot stack another one.
    if (session.user.originalUserId) {
        return NextResponse.json(
            { error: "Already impersonating another user" },
            { status: 400 }
        );
    }

    const adminCheck = await isAdmin(session.user.id, session.user.role);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { userId?: string };
    try {
        body = (await request.json()) as { userId?: string };
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetId = body.userId?.trim();
    if (!targetId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (targetId === session.user.id) {
        return NextResponse.json(
            { error: "Cannot impersonate yourself" },
            { status: 400 }
        );
    }

    const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: {
            id: true,
            username: true,
            email: true,
            isBanned: true,
            role: { select: { name: true } },
        },
    });
    if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.isBanned) {
        return NextResponse.json(
            { error: "Cannot impersonate a banned user" },
            { status: 400 }
        );
    }
    if (target.role?.name === "admin") {
        return NextResponse.json(
            { error: "Cannot impersonate another admin" },
            { status: 400 }
        );
    }

    await logActivity({
        userId: session.user.id,
        action: "admin.impersonate.start",
        entity: "user",
        entityId: targetId,
        metadata: {
            targetUsername: target.username,
            targetEmail: target.email,
        },
    });

    return NextResponse.json({
        success: true,
        target: {
            id: target.id,
            username: target.username,
            email: target.email,
        },
    });
}
