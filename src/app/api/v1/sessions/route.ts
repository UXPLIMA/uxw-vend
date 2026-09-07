import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { MAX_LISTED_DEVICES } from "@/core/lib/session-registry";

/**
 * GET - list current user's active sessions.
 * Excludes expired and revoked rows.
 *
 * The row is selected rather than returned whole. `tokenId` is the claim the
 * JWT carries and the key this table is looked up by when a session is
 * checked for revocation; the screen that lists devices has never used it, and
 * an identifier that answers "which session is this" does not belong in a
 * response just because it sits in the same row as the device name.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessions = await prisma.userSession.findMany({
        where: {
            userId: session.user.id,
            isRevoked: false,
            expiresAt: { gt: new Date() },
        },
        orderBy: { lastActiveAt: "desc" },
        // Narrowing to one user is not a ceiling here: a row is written per
        // sign-in, not per device, and a live one lasts as long as its token.
        take: MAX_LISTED_DEVICES,
        select: {
            id: true,
            deviceInfo: true,
            ipAddress: true,
            userAgent: true,
            lastActiveAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    return NextResponse.json({ sessions });
}
