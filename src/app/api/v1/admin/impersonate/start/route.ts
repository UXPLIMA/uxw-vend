import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { impersonationRefusal } from "@/core/lib/impersonation";
import { z } from "zod";

const startImpersonationSchema = z.object({
    userId: z.string().trim().min(1, "userId is required").max(64),
});

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

    // Only real admins may start impersonation. The rest of the rules live in
    // `impersonationRefusal`, because the token is not written here: the
    // client follows up with `update()` and the `jwt` callback does it, so
    // both have to reach the same answer.
    const adminCheck = await isAdmin(session.user.id, session.user.role);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = startImpersonationSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const targetId = parsed.data.userId;

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
    const refusal = impersonationRefusal(
        {
            id: session.user.id,
            role: "admin",
            originalUserId: session.user.originalUserId ?? undefined,
        },
        target,
    );
    // `|| !target` is what narrows the type: the refusal already covers a
    // missing row, and saying so here keeps the two from disagreeing.
    if (refusal || !target) {
        const said: Record<string, { error: string; status: 400 | 403 | 404 }> = {
            not_admin: { error: "Forbidden", status: 403 },
            already: { error: "Already impersonating another user", status: 400 },
            self: { error: "Cannot impersonate yourself", status: 400 },
            not_found: { error: "User not found", status: 404 },
            banned: { error: "Cannot impersonate a banned user", status: 400 },
            admin_target: { error: "Cannot impersonate another admin", status: 400 },
        };
        const answer = said[refusal ?? "not_found"];
        return NextResponse.json({ error: answer.error }, { status: answer.status });
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
