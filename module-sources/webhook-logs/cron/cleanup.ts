import { log, prisma } from "@/core/sdk/server";

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
            log.info("cron: webhook logs pruned", { job: "webhook-logs:cleanup", deleted: result.count });
        }
    } catch (err) {
        log.error("[cron] webhook-logs-cleanup failed", { error: err instanceof Error ? err.message : String(err) });
    }
}
