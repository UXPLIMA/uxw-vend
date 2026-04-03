import { prisma } from "./db";

/**
 * Scheduled tasks - call from a cron job or admin API
 * Example: curl -X POST http://localhost:3000/api/v1/admin/cron -H "x-api-key: YOUR_KEY"
 */

export async function runScheduledTasks() {
    const results: string[] = [];

    // 1. Expire old coupons
    const expiredCoupons = await prisma.coupon.updateMany({
        where: { expiresAt: { lt: new Date() }, isActive: true },
        data: { isActive: false },
    });
    if (expiredCoupons.count > 0) results.push(`Expired ${expiredCoupons.count} coupons`);

    // 2. Close old resolved tickets (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const closedTickets = await prisma.ticket.updateMany({
        where: { status: "RESOLVED", updatedAt: { lt: sevenDaysAgo } },
        data: { status: "CLOSED", closedAt: new Date() },
    });
    if (closedTickets.count > 0) results.push(`Auto-closed ${closedTickets.count} resolved tickets`);

    // 3. Expire gift codes
    const expiredGifts = await prisma.giftCode.updateMany({
        where: { expiresAt: { lt: new Date() }, isRedeemed: false },
        data: { isRedeemed: true },
    });
    if (expiredGifts.count > 0) results.push(`Expired ${expiredGifts.count} gift codes`);

    // 4. Cancel old pending orders (24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cancelledOrders = await prisma.order.updateMany({
        where: { status: "PENDING", createdAt: { lt: oneDayAgo } },
        data: { status: "CANCELLED" },
    });
    if (cancelledOrders.count > 0) results.push(`Cancelled ${cancelledOrders.count} stale pending orders`);

    return results;
}
