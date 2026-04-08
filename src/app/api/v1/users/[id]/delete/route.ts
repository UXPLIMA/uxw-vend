import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { softDeleteUser } from "@/core/lib/user-deletion";
import { logActivity } from "@/core/lib/activity-log";
import { getClientIP } from "@/core/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
    confirmUsername: z.string().min(1),
    reason: z.string().optional(),
});

// POST /api/v1/users/[id]/delete (admin-only)
// Right-to-be-forgotten action invoked by an administrator on behalf of
// a user (support ticket, legal demand). Requires typed confirmation of
// the target username to guard against wrong-row accidents.
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: targetId } = await params;

    if (targetId === session.user.id) {
        return NextResponse.json(
            { error: "Use the profile Privacy page to delete your own account" },
            { status: 400 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 }
        );
    }

    const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, username: true },
    });
    if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (parsed.data.confirmUsername !== target.username) {
        return NextResponse.json(
            { error: "Confirmation username does not match" },
            { status: 400 }
        );
    }

    const result = await softDeleteUser(
        targetId,
        parsed.data.reason || "Admin-initiated deletion"
    );
    if (!result.success) {
        return NextResponse.json(
            { error: result.error ?? "Failed to delete account" },
            { status: 500 }
        );
    }

    await logActivity({
        userId: session.user.id,
        action: "admin.user.deleted",
        entity: "User",
        entityId: targetId,
        metadata: {
            targetUsername: target.username,
            reason: parsed.data.reason ?? null,
        },
        ipAddress: getClientIP(request.headers),
    });

    return NextResponse.json({ success: true });
}
