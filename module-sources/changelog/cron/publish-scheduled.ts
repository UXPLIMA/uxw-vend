import { prisma } from "@/core/lib/db";

/**
 * Publish changelog entries whose `publishAt` has elapsed. Clears the
 * `publishAt` timestamp so the entry becomes publicly visible.
 */
export default async function publishScheduled(): Promise<void> {
    const now = new Date();
    try {
        const result = await prisma.changelogEntry.updateMany({
            where: { publishAt: { lte: now } },
            data: { publishAt: null },
        });
        if (result.count > 0) {
            console.log(`[changelog] publish-scheduled: ${result.count} entry/entries`);
        }
    } catch (err) {
        console.error("[changelog] publish-scheduled failed:", err);
    }
}
