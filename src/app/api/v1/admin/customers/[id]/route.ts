import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { applyFiltersAsync } from "@/core/lib/hooks";
import { ensureHooks } from "@/core/lib/hooks-bootstrap";
import { readUserAgent } from "@/core/lib/user-agent";
import { restrictionsOn } from "@/core/lib/restrictions-server";

/**
 * GET /api/v1/admin/customers/[id] - one member, from every angle at once.
 *
 * An operator opens this when somebody writes in, and what they need is spread
 * across everything installed: what they bought, what they are owed, what they
 * have asked for, what has been done about them. Gathering that here would
 * mean knowing which modules exist, so it is asked for and whoever is
 * installed answers.
 *
 * The columns are named rather than taken whole. A screen about a person is
 * the screen most likely to be built by selecting the person, and a user row
 * carries a password hash and the counters that throttle their sign-ins.
 */
type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
    await ensureHooks();

    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            locale: true,
            createdAt: true,
            emailVerified: true,
            isBanned: true,
            banReason: true,
            role: { select: { id: true, name: true, displayName: true, color: true } },
        },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    /*
     * The sessions, as a login history. `tokenId` is deliberately not among
     * the columns: it is the live revocation key, and a screen that shows it
     * hands whoever is reading the ability to end somebody's session from a
     * screenshot.
     */
    const sessions = await prisma.userSession.findMany({
        where: { userId: id },
        orderBy: { lastActiveAt: "desc" },
        select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            deviceInfo: true,
            lastActiveAt: true,
            createdAt: true,
            expiresAt: true,
            isRevoked: true,
        },
        take: 25,
    });

    // The reader's own language, so a panel answers in it. Their row, not the
    // request: an API route carries no locale segment.
    const reader = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { locale: true },
    });

    const [panels, restrictions] = await Promise.all([
        applyFiltersAsync("admin.customer.panels", [], {
            userId: id,
            locale: reader?.locale || "en",
        }),
        restrictionsOn(id),
    ]);

    return NextResponse.json(
        {
            user,
            logins: sessions.map((row) => ({
                id: row.id,
                ipAddress: row.ipAddress,
                lastActiveAt: row.lastActiveAt,
                createdAt: row.createdAt,
                // A session that has been revoked or has run out is history,
                // not somebody who is signed in.
                current: !row.isRevoked && row.expiresAt.getTime() > Date.now(),
                agent: readUserAgent(row.userAgent),
            })),
            restrictions,
            panels,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}
