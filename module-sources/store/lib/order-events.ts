/**
 * Announcing an order, with the same payload every time.
 *
 * The order hooks used to be fired with whatever object the call site happened
 * to be holding: one path had the line items included, another had the buyer,
 * a third had neither. A listener could not rely on any of it, which makes an
 * order notification close to useless - "an order completed" without saying
 * what was in it.
 *
 * Both hooks now go through here, which loads the order the same way each
 * time. The extra read costs one query per completed order.
 */
import { prisma } from "@/core/sdk/server";
import { doActionAsync } from "@/core/sdk";

async function loadOrder(orderId: string) {
    return prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                select: { id: true, productId: true, name: true, quantity: true, price: true },
            },
        },
    });
}

/** Fired once when an order row is created, whether or not it is paid yet. */
export async function announceOrderCreated(orderId: string): Promise<void> {
    const order = await loadOrder(orderId);
    if (!order) return;
    await doActionAsync("store.order.created", order);
}

/** Fired once the order is paid for and its contents have been granted. */
export async function announceOrderCompleted(orderId: string): Promise<void> {
    const order = await loadOrder(orderId);
    if (!order) return;
    await doActionAsync("store.order.completed", order);
}
