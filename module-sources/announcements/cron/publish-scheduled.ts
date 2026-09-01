import { log, prisma } from "@/core/sdk/server";

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
            log.info("cron: announcements published", { job: "announcements:publish-scheduled", published: result.count });
        }
    } catch (err) {
        console.error("[announcements] publish-scheduled failed:", err);
    }
}
