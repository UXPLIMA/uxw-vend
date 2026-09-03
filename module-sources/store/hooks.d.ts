/**
 * Payload contract for the hooks this module fires. See blog/hooks.d.ts for
 * why the emitter owns these shapes and what widening/narrowing means.
 *
 * `total` is a Prisma Decimal, which is a runtime object rather than a number -
 * it is typed `unknown` deliberately so a listener has to convert it (with
 * `Number(...)`) instead of formatting an object into a message.
 */
declare global {
    interface UxwVendHookPayloads {
        "store.order.created": StoreOrderHookPayload;
        "store.order.completed": StoreOrderHookPayload;
        "store.product.created": { id: string; name: string; slug: string };
    }
}

interface StoreOrderHookPayload {
    id: string;
    /** Null once the buyer deletes their account - Order.userId is SetNull. */
    userId: string | null;
    orderNumber: string;
    status?: string;
    total: unknown;
    currency?: string;
    paymentMethod?: string | null;
    metadata?: unknown;
}

export {};
