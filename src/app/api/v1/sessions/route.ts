import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

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
