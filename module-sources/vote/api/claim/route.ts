import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";

// POST /api/v1/vote/claim - Claim vote reward
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `vote-claim:${session.user.id}`,
        { maxRequests: 10, windowMs: 3_600_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { voteSiteId } = await request.json();
    if (!voteSiteId) return NextResponse.json({ error: "Vote site ID required" }, { status: 400 });

    const site = await prisma.voteSite.findUnique({ where: { id: voteSiteId } });
    if (!site) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    // Use transaction to prevent race condition on vote claiming
    try {
        const reward = await prisma.$transaction(async (tx) => {
            // Check cooldown (24 hours per site)
            const lastVote = await tx.voteLog.findFirst({
                where: { userId: session.user.id, voteSiteId },
                orderBy: { createdAt: "desc" },
            });

            if (lastVote) {
                const hoursSince = (Date.now() - lastVote.createdAt.getTime()) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                    const hoursLeft = Math.ceil(24 - hoursSince);
                    throw new Error(`COOLDOWN:You can vote again in ${hoursLeft} hours`);
                }
            }

            // Log vote
            await tx.voteLog.create({
                data: { userId: session.user.id, voteSiteId },
            });

            // Award credits
            if (site.reward > 0) {
                await tx.user.update({
                    where: { id: session.user.id },
                    data: { creditBalance: { increment: site.reward } },
                });

                await tx.creditTransaction.create({
                    data: {
                        userId: session.user.id,
                        amount: site.reward,
                        type: "vote_reward",
                        description: `Vote reward from ${site.name}`,
                    },
                });
            }

            return site.reward;
        });

        // Fire hook + activity feed entry
        const { doActionAsync } = await import("@/core/lib/hooks");
        await doActionAsync("vote.vote.cast", {
            userId: session.user.id,
            voteSiteId,
            siteName: site.name,
            reward,
        });
        await prisma.activityFeedItem.create({
            data: {
                type: "vote.vote.cast",
                actorId: session.user.id,
                title: `Voted on ${site.name}${reward > 0 ? ` and earned ${reward} credits` : ""}`,
                icon: "ThumbsUp",
                isPublic: true,
            },
        }).catch(() => {});

        return NextResponse.json({
            message: `Vote recorded! You earned ${reward} credits.`,
            reward,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.startsWith("COOLDOWN:")) {
            return NextResponse.json({ error: message.slice(9) }, { status: 429 });
        }
        throw err;
    }
}
