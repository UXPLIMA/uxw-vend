import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { prisma } from "@/core/lib/db";

/**
 * POST - revoke every session the current user has, this one included.
 *
 * The screen calls it "sign out everywhere" and says every device will need to
 * log in again, so the caller's own device is not spared: the jwt callback
 * reads `isRevoked` on its next scheduled check and ends the token there. The
 * client sends the browser to the login page rather than waiting for that.
 */
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `session-revoke-all:${session.user.id}`,
        { maxRequests: 10, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const result = await prisma.userSession.updateMany({
        where: { userId: session.user.id, isRevoked: false },
        data: { isRevoked: true },
    });

    return NextResponse.json({ count: result.count });
}
