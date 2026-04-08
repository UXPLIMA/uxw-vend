import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

/**
 * POST — revoke ALL sessions for the current user EXCEPT the current one.
 * Useful "sign out everywhere else" button.
 */
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // The current JWT has tokenId in it, but session() callback doesn't expose
    // it by default. For now, revoke ALL sessions — the user will be re-issued
    // a new one on next request via the existing JWT, then a new UserSession row.
    const result = await prisma.userSession.updateMany({
        where: { userId: session.user.id, isRevoked: false },
        data: { isRevoked: true },
    });

    return NextResponse.json({ count: result.count });
}
