import { createNotification } from "../lib/notifications";

/**
 * Hook listener: `store.order.completed`.
 *
 * `userId` is nullable - Order.userId is SetNull, so an order outlives the
 * buyer who deleted their account. There is nobody left to tell.
 */
export default async function onOrderCompleted(payload: {
    userId: string | null;
    orderNumber: string;
}): Promise<void> {
    if (!payload?.userId) return;
    await createNotification({
        userId: payload.userId,
        title: "Order complete",
        message: `Order ${payload.orderNumber} is complete.`,
        titleKey: "notif_orderCompleteTitle",
        messageKey: "notif_orderCompleteMessage",
        params: { orderNumber: payload.orderNumber },
        type: "success",
        href: "/profile",
    });
}
