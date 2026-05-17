import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

/**
 * GET /api/v1/me/trophies
 *
 * Returns the signed-in user's earned trophies plus the total count of
 * active trophies (so the profile card can show "X of Y earned").
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [earned, total] = await Promise.all([
        prisma.userTrophy.findMany({
            where: { userId: session.user.id },
            orderBy: { awardedAt: "desc" },
            include: {
                trophy: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        icon: true,
                        color: true,
                        points: true,
                    },
                },
            },
        }),
        prisma.trophy.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
        earned: earned.map((e) => ({
            id: e.id,
            awardedAt: e.awardedAt.toISOString(),
            trophy: e.trophy,
        })),
        total,
    });
}
