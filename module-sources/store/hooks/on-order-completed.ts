import { prisma } from "@/core/sdk/server";
import type { HookHandlerFor } from "@/core/sdk";

/**
 * Records a private ActivityFeedItem when a store order is completed.
 * Order details stay private to the user — feed entry is not public.
 * Wired via the store manifest's `hookListeners` entry on `store.order.completed`.
 */
const onStoreOrderCompleted: HookHandlerFor<"store.order.completed", "action"> = async (payload) => {
    // The buyer's account can be deleted between purchase and fulfilment, which
    // nulls Order.userId. There is no actor to attribute the entry to then.
    if (!payload.userId) return;
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
};

export default onStoreOrderCompleted;
