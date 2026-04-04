import { prisma } from "./db";
import {
    ORDER_AUTO_CANCEL_HOURS,
    TICKET_AUTO_CLOSE_DAYS,
} from "./constants";

async function getSetting(key: string, defaultValue: string): Promise<string> {
    const s = await prisma.setting.findUnique({ where: { key } });
    return (s?.value as string) ?? defaultValue;
}

/**
 * Scheduled tasks - call from a cron job or admin API
 * Example: curl -X POST http://localhost:3000/api/v1/admin/cron -H "x-api-key: YOUR_KEY"
 */

export async function runScheduledTasks() {
    const results: string[] = [];

    // 1. Expire old coupons (core — coupons exist in schema regardless of modules)
    const expiredCoupons = await prisma.coupon.updateMany({
        where: { expiresAt: { lt: new Date() }, isActive: true },
        data: { isActive: false },
    });
    if (expiredCoupons.count > 0) results.push(`Expired ${expiredCoupons.count} coupons`);

    // 2. Close old resolved tickets
    try {
        const ticketAutoCloseDays = Number(await getSetting("ticket_auto_close_days", String(TICKET_AUTO_CLOSE_DAYS)));
        const ticketCutoff = new Date(Date.now() - ticketAutoCloseDays * 24 * 60 * 60 * 1000);
        const closedTickets = await prisma.ticket.updateMany({
            where: { status: "RESOLVED", updatedAt: { lt: ticketCutoff } },
            data: { status: "CLOSED", closedAt: new Date() },
        });
        if (closedTickets.count > 0) results.push(`Auto-closed ${closedTickets.count} resolved tickets`);
    } catch { /* ticket model unavailable */ }

    // 3. Expire gift codes (core — gift codes exist in schema regardless of modules)
    const expiredGifts = await prisma.giftCode.updateMany({
        where: { expiresAt: { lt: new Date() }, isRedeemed: false },
        data: { isRedeemed: true },
    });
    if (expiredGifts.count > 0) results.push(`Expired ${expiredGifts.count} gift codes`);

    // 4. Cancel old pending orders
    try {
        const orderAutoCancelHours = Number(await getSetting("order_auto_cancel_hours", String(ORDER_AUTO_CANCEL_HOURS)));
        const orderCutoff = new Date(Date.now() - orderAutoCancelHours * 60 * 60 * 1000);
        const cancelledOrders = await prisma.order.updateMany({
            where: { status: "PENDING", createdAt: { lt: orderCutoff } },
            data: { status: "CANCELLED" },
        });
        if (cancelledOrders.count > 0) results.push(`Cancelled ${cancelledOrders.count} stale pending orders`);
    } catch { /* order model unavailable */ }

    return results;
}
