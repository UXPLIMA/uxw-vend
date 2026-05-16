import { prisma } from "@/core/lib/db";

interface OrderCompletedPayload {
    id: string;
    orderNumber?: string;
    userId: string;
}

/**
 * Records a private ActivityFeedItem when a store order is completed.
 * Order details stay private to the user — feed entry is not public.
 * Wired via the store manifest's `hookListeners` entry on `store.order.completed`.
 */
export default async function onStoreOrderCompleted(
    payload: OrderCompletedPayload,
): Promise<void> {
    try {
        await prisma.activityFeedItem.create({
            data: {
                type: "store.order.completed",
                actorId: payload.userId,
                title: `Completed order #${payload.orderNumber || payload.id}`,
                icon: "ShoppingBag",
                isPublic: false,
            },
        });
    } catch {
        /* non-fatal */
    }
}
