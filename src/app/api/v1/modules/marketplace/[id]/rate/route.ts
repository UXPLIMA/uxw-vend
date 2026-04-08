import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { updateIndexRating } from "../../_index-writer";

const rateSchema = z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
});

// POST /api/v1/modules/marketplace/[id]/rate
// Creates or updates the caller's rating for a given module. Admin-only.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: moduleId } = await params;
    if (!/^[a-z0-9-]+$/.test(moduleId)) {
        return NextResponse.json({ error: "Invalid module id" }, { status: 400 });
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = rateSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid rating", issues: parsed.error.issues },
            { status: 400 },
        );
    }

    const { rating, review } = parsed.data;

    // Upsert keyed on the compound unique (moduleId, userId) — one rating per user.
    const saved = await prisma.moduleRating.upsert({
        where: {
            moduleId_userId: {
                moduleId,
                userId: session.user.id,
            },
        },
        update: { rating, review: review ?? null },
        create: {
            moduleId,
            userId: session.user.id,
            rating,
            review: review ?? null,
        },
    });

    // Recompute aggregates and mirror them into the on-disk index.json so
    // cold starts see correct numbers without waiting for the next rebuild.
    const agg = await prisma.moduleRating.aggregate({
        where: { moduleId },
        _avg: { rating: true },
        _count: { _all: true },
    });
    const avg = agg._avg.rating !== null ? Number(agg._avg.rating) : null;
    updateIndexRating(moduleId, avg, agg._count._all).catch(() => { /* non-fatal */ });

    return NextResponse.json({
        rating: {
            id: saved.id,
            moduleId: saved.moduleId,
            rating: saved.rating,
            review: saved.review,
            updatedAt: saved.updatedAt,
        },
        aggregate: {
            average: avg !== null ? Math.round(avg * 10) / 10 : null,
            count: agg._count._all,
        },
    });
}
