import { NextRequest, NextResponse } from "next/server";
import { prisma, rateLimitForRoleAsync, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { voteClaimSchema } from "../../lib/validations";

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

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = voteClaimSchema.safeParse(jsonBody);
    if (!parsed.success) return NextResponse.json({ error: "Vote site ID required" }, { status: 400 });
    const { voteSiteId } = parsed.data;

    const site = await prisma.voteSite.findUnique({ where: { id: voteSiteId } });
    if (!site) return NextResponse.json({ error: "Vote site not found" }, { status: 404 });

    // A transaction on its own does not prevent a double claim: under read
    // committed, two claims submitted together both read no recent vote log
    // and both go on to write one and award the credits. The invariant here is
    // "no row newer than the cutoff", which no conditional write can express,
    // so the isolation level has to carry it. Postgres aborts one of two
    // serializable transactions whose reads and writes conflict this way; that
    // abort is answered below as a retry, not a 500.
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
        }, { isolationLevel: "Serializable" });

        // Fire hook + activity feed entry
        const { doActionAsync } = await import("@/core/sdk");
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
        // P2034: the transaction was aborted for conflicting with another one.
        // Two claims arrived together and Postgres kept exactly one, which is
        // the point. The caller is told to try again rather than shown a 500.
        const code = (err as { code?: string }).code;
        if (code === "P2034") {
            return NextResponse.json(
                { error: "Another claim is in flight. Try again in a moment." },
                { status: 409 },
            );
        }
        throw err;
    }
}
