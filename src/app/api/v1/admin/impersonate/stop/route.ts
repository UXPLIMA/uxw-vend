import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { logActivity } from "@/core/lib/activity-log";

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
