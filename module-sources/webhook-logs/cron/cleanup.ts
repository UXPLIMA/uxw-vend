import { prisma } from "@/core/lib/db";

/**
 * Webhook logs cleanup cron job.
 *
 * Removes WebhookLog rows older than 30 days. Runs daily.
 */
export default async function cleanupWebhookLogs(): Promise<void> {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await prisma.webhookLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });
        if (result.count > 0) {
            console.log(`[cron] webhook-logs-cleanup: deleted ${result.count} rows`);
        }
    } catch (err) {
        console.error("[cron] webhook-logs-cleanup failed:", err);
    }
}
