import { prisma } from "@/core/lib/db";

/**
 * Publish announcements whose `publishAt` has elapsed. Clears the
 * `publishAt` timestamp so the announcement becomes active.
 */
export default async function publishScheduled(): Promise<void> {
    const now = new Date();
    try {
        const result = await prisma.announcement.updateMany({
            where: { publishAt: { lte: now } },
            data: { publishAt: null },
        });
        if (result.count > 0) {
            console.log(`[announcements] publish-scheduled: ${result.count} announcement(s)`);
        }
    } catch (err) {
        console.error("[announcements] publish-scheduled failed:", err);
    }
}
