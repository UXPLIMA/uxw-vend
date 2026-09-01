import { sendDiscordWebhook } from "../lib/discord";
import { orderFields, type OrderPayload } from "./order-fields";

/**
 * Hook listener: fires on `store.order.created`.
 * An order that is already COMPLETED at creation time (credits / free
 * checkout) is left to the `store.order.completed` listener so the same
 * purchase is not announced twice.
 */
export default async function onOrderCreated(payload: OrderPayload): Promise<void> {
    if (payload.status === "COMPLETED") return;

    await sendDiscordWebhook("order_created", {
        embeds: [{
            title: "New Order",
            color: 0x3b82f6,
            fields: orderFields(payload),
            timestamp: new Date().toISOString(),
        }],
    });
}
