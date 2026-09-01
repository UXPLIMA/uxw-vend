import { sendDiscordWebhook } from "../lib/discord";
import { orderFields, type OrderPayload } from "./order-fields";

/**
 * Hook listener: fires on `store.order.completed`.
 * Announces a paid/fulfilled order on Discord.
 */
export default async function onOrderCompleted(payload: OrderPayload): Promise<void> {
    await sendDiscordWebhook("order_completed", {
        embeds: [{
            title: "Order Completed",
            color: 0x22c55e,
            fields: orderFields(payload),
            timestamp: new Date().toISOString(),
        }],
    });
}
