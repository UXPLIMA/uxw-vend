/**
 * Paying a percentage of a purchase back as credits.
 *
 * It goes in through the same door anything else would use, rather than
 * writing a balance itself. That is the point of the door: the first rule to
 * write its own increment is the one that forgets the ledger row.
 *
 * The order id is the key, so an order completing twice - a retried callback,
 * an operator marking one paid that a webhook was already settling - awards
 * once.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { applyFiltersAsync } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { cashbackFor } from "../lib/cashback";
import { cashbackPercent } from "../lib/setup";

const onOrderCompleted: HookHandlerFor<"store.order.completed", "action"> = async (order) => {
    if (!order.userId) return;

    const decision = cashbackFor(
        { total: order.total, paymentMethod: order.paymentMethod },
        await cashbackPercent(),
    );
    if ("skip" in decision) return;

    const outcome = await applyFiltersAsync(
        "credits.award",
        { handled: false, duplicate: false, error: null },
        {
            userId: order.userId,
            amount: decision.award,
            reason: "cashback",
            key: order.id,
            description: `Cashback on order ${order.orderNumber}`,
        },
    );

    if (outcome.error) {
        log.error("[credits] cashback was refused", { orderId: order.id, error: outcome.error });
    }
};

export default onOrderCompleted;
