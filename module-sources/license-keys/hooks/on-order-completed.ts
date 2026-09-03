/**
 * Hands the buyer their keys the moment an order completes.
 *
 * Only products an operator has set up on the licensed-products page get one,
 * matched by the opaque product id in the order line. Everything else in the
 * order is ignored, so a single order can contain licensed and unlicensed
 * items without special handling.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma, log } from "@/core/sdk/server";
import { issueKeys } from "../lib/licenses";

const onOrderCompleted: HookHandlerFor<"store.order.completed", "action"> = async (order) => {
    const productIds = (order.items ?? [])
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id));
    if (productIds.length === 0) return;

    const licensed = await prisma.licenseProduct.findMany({ where: { productId: { in: productIds } } });
    if (licensed.length === 0) return;

    const byProduct = new Map(licensed.map((row) => [row.productId, row]));

    for (const item of order.items ?? []) {
        const config = item.productId ? byProduct.get(item.productId) : undefined;
        if (!config) continue;

        // Already issued: an order can complete twice - a webhook retry, a
        // manual re-run - and the buyer must not accumulate keys for it.
        const alreadyIssued = await prisma.licenseKey.count({
            where: { orderId: order.id, productId: item.productId },
        });
        if (alreadyIssued > 0) continue;

        const count = Math.max(1, config.keysPerUnit) * Math.max(1, item.quantity);
        try {
            await issueKeys(count, {
                productId: item.productId,
                productName: item.name,
                orderId: order.id,
                userId: order.userId,
                maxActivations: config.maxActivations,
                validDays: config.validDays,
                prefix: config.prefix,
            });
        } catch (error) {
            // The order is already paid for. Losing the keys is bad; throwing
            // here would also lose whatever the next listener was going to do.
            log.error("[license-keys] could not issue keys for a completed order", {
                orderId: order.id,
                productId: item.productId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
};

export default onOrderCompleted;
