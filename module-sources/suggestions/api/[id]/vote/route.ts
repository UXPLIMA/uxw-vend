import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { rateLimitForRole } from "@/core/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/suggestions/[id]/vote - Toggle upvote
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await rateLimitForRole(
        `suggestion-vote:${session.user.id}`,
        { maxRequests: 20, windowMs: 60_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;

    const suggestion = await prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existingVote = await prisma.suggestionVote.findUnique({
        where: { suggestionId_userId: { suggestionId: id, userId: session.user.id } },
    });

    const { doActionAsync } = await import("@/core/lib/hooks");

    if (existingVote) {
        await prisma.suggestionVote.delete({ where: { id: existingVote.id } });
        await prisma.suggestion.update({ where: { id }, data: { upvotes: { decrement: 1 } } });
        await doActionAsync("suggestions.suggestion.unvoted", { suggestion, userId: session.user.id });
        return NextResponse.json({ voted: false, upvotes: suggestion.upvotes - 1 });
    } else {
        await prisma.suggestionVote.create({
            data: { suggestionId: id, userId: session.user.id },
        });
        await prisma.suggestion.update({ where: { id }, data: { upvotes: { increment: 1 } } });
        await doActionAsync("suggestions.suggestion.voted", { suggestion, userId: session.user.id });
        return NextResponse.json({ voted: true, upvotes: suggestion.upvotes + 1 });
    }
}
