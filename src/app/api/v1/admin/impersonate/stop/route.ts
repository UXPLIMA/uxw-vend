import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { logActivity } from "@/core/lib/activity-log";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";

/**
 * POST /api/v1/admin/impersonate/stop
 *
 * Clears the impersonation flag on the JWT. The client must follow up
 * with `update({ stopImpersonating: true })` so Auth.js restores the
 * original admin identity in the token.
 */
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Every call writes an activity-log row, so the endpoint is a way to grow
    // that table even though it changes nothing else.
    const allowed = await rateLimitForRoleAsync(
        `impersonate-stop:${session.user.id}`,
        { maxRequests: 20, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const realAdminId = session.user.originalUserId;
    if (!realAdminId) {
        return NextResponse.json(
            { error: "Not currently impersonating" },
            { status: 400 }
        );
    }

    await logActivity({
        userId: realAdminId,
        action: "admin.impersonate.stop",
        entity: "user",
        entityId: session.user.id,
        metadata: {
            impersonatedUserId: session.user.id,
        },
    });

    return NextResponse.json({ success: true });
}
