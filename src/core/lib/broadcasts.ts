import { prisma } from "@/core/lib/db";
import { sendEmail } from "@/core/lib/email";

interface BroadcastFilter {
    all?: boolean;
    roleIds?: string[];
    userIds?: string[];
}

/**
 * Email broadcast helpers.
 *
 * The cron job "core:process-broadcasts" calls processQueuedBroadcasts()
 * once per minute. It picks up status="queued" rows, fans out the email
 * to the recipients in batches with a small delay to respect rate limits,
 * and updates progress columns.
 *
 * Send via the existing core/lib/email.ts which delegates to the active
 * provider (resend-provider, etc.).
 */

async function resolveRecipients(filter: BroadcastFilter): Promise<{ id: string; email: string; username: string }[]> {
    const where: Record<string, unknown> = { isBanned: false };

    if (filter.userIds && filter.userIds.length > 0) {
        where.id = { in: filter.userIds };
    } else if (filter.roleIds && filter.roleIds.length > 0) {
        where.roleId = { in: filter.roleIds };
    }
    // filter.all = true → no extra constraint, returns everyone

    const users = await prisma.user.findMany({
        where,
        select: { id: true, email: true, username: true },
    });
    return users.filter((u) => !!u.email);
}

/** Queue a broadcast for delivery — sets status to "queued" and counts recipients. */
export async function queueBroadcast(broadcastId: string): Promise<{ totalCount: number }> {
    const broadcast = await prisma.emailBroadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) throw new Error("Broadcast not found");

    const recipients = await resolveRecipients(broadcast.filter as BroadcastFilter);
    await prisma.emailBroadcast.update({
        where: { id: broadcastId },
        data: { status: "queued", totalCount: recipients.length },
    });
    return { totalCount: recipients.length };
}

/** Cron-driven processor: picks up queued broadcasts, sends in batches. */
export async function processQueuedBroadcasts(): Promise<void> {
    const broadcast = await prisma.emailBroadcast.findFirst({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
    });
    if (!broadcast) return;

    await prisma.emailBroadcast.update({
        where: { id: broadcast.id },
        data: { status: "sending", startedAt: new Date() },
    });

    const recipients = await resolveRecipients(broadcast.filter as BroadcastFilter);
    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;

    // Process in chunks of 50 with a 200ms delay between chunks
    const BATCH = 50;
    for (let i = 0; i < recipients.length; i += BATCH) {
        const batch = recipients.slice(i, i + BATCH);
        await Promise.all(batch.map(async (user) => {
            try {
                await sendEmail({
                    to: user.email,
                    subject: broadcast.subject,
                    html: broadcast.body.replace(/\{username\}/g, user.username),
                });
                sent++;
            } catch (err) {
                failed++;
                lastError = err instanceof Error ? err.message : String(err);
            }
        }));

        // Periodic progress save (every 5 batches)
        if (i % (BATCH * 5) === 0) {
            await prisma.emailBroadcast.update({
                where: { id: broadcast.id },
                data: { sentCount: sent, failedCount: failed },
            });
        }

        if (i + BATCH < recipients.length) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    await prisma.emailBroadcast.update({
        where: { id: broadcast.id },
        data: {
            status: failed > 0 && sent === 0 ? "failed" : "sent",
            sentCount: sent,
            failedCount: failed,
            lastError,
            completedAt: new Date(),
        },
    });

    console.log(`[broadcast] ${broadcast.id} done: ${sent} sent, ${failed} failed`);
}
