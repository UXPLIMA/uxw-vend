import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// POST /api/v1/vote/claim - Claim vote reward
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { voteSiteId } = await request.json();
    if (!voteSiteId) return NextResponse.json({ error: "Vote site ID required" }, { status: 400 });

    const site = await prisma.voteSite.findUnique({ where: { id: voteSiteId } });
    if (!site) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    // Check cooldown (24 hours per site)
    const lastVote = await prisma.voteLog.findFirst({
        where: { userId: session.user.id, voteSiteId },
        orderBy: { createdAt: "desc" },
    });

    if (lastVote) {
        const hoursSince = (Date.now() - lastVote.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
            const hoursLeft = Math.ceil(24 - hoursSince);
            return NextResponse.json({
                error: `You can vote again in ${hoursLeft} hours`,
            }, { status: 429 });
        }
    }

    // Log vote
    await prisma.voteLog.create({
        data: { userId: session.user.id, voteSiteId },
    });

    // Award credits
    if (site.reward > 0) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { creditBalance: { increment: site.reward } },
        });

        await prisma.creditTransaction.create({
            data: {
                userId: session.user.id,
                amount: site.reward,
                type: "vote_reward",
                description: `Vote reward from ${site.name}`,
            },
        });
    }

    return NextResponse.json({
        message: `Vote recorded! You earned ${site.reward} credits.`,
        reward: site.reward,
    });
}
