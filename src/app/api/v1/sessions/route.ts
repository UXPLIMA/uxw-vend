import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

/**
 * GET — list current user's active sessions.
 * Excludes expired and revoked rows.
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
    });

    return NextResponse.json({ sessions });
}
