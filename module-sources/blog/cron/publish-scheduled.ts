import { prisma } from "@/core/lib/db";

/**
 * Publish blog articles whose `publishAt` has elapsed.
 *
 * Runs every 5 minutes via the core scheduler. Picks up any article that
 * is still in SCHEDULED status with a `publishAt` in the past, flips it to
 * PUBLISHED, clears the schedule timestamp, and records `publishedAt`.
 */
export default async function publishScheduled(): Promise<void> {
    const now = new Date();
    try {
        const result = await prisma.blogArticle.updateMany({
            where: { publishAt: { lte: now }, status: "SCHEDULED" },
            data: { status: "PUBLISHED", publishAt: null, publishedAt: now },
        });
        if (result.count > 0) {
            console.log(`[blog] publish-scheduled: ${result.count} article(s)`);
        }
    } catch (err) {
        console.error("[blog] publish-scheduled failed:", err);
    }
}
