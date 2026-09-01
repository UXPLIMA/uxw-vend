/**
 * What this module reads out of a `store.order.*` payload. Deliberately its own
 * declaration rather than an import from `store`: a listener must compile
 * whether or not the emitting module is installed. Compatibility with what
 * `store` actually promises is verified by `npm run typecheck:modules`.
 */
export interface OrderPayload {
    orderNumber: string;
    status?: string;
    total: unknown;
    currency?: string;
    paymentMethod?: string | null;
    // `unknown` because the emitter passes a Prisma Json column through
    // untouched; narrow it here rather than claiming a shape upstream.
    metadata?: unknown;
}

/** `total` arrives as a Prisma Decimal, which stringifies but does not format. */
export function orderFields(order: OrderPayload) {
    const meta = order.metadata as Record<string, unknown> | null | undefined;
    const player = meta?.playerName;
    return [
        { name: "Order", value: order.orderNumber, inline: true },
        { name: "Total", value: `${Number(order.total).toFixed(2)} ${(order.currency ?? "").toUpperCase()}`.trim(), inline: true },
        ...(order.paymentMethod ? [{ name: "Method", value: order.paymentMethod, inline: true }] : []),
        ...(typeof player === "string" && player ? [{ name: "Player", value: player, inline: true }] : []),
    ];
}
