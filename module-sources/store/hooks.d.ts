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

interface StoreOrderItemHookPayload {
    id: string;
    /** Null once the product is deleted - OrderItem.productId is optional. */
    productId: string | null;
    /** Product name as it was at purchase time, not as it is now. */
    name: string;
    quantity: number;
    /** A Prisma Decimal, like `total`. Convert before showing it. */
    price: unknown;
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
    /**
     * What was bought. Always present: both order hooks load the order the
     * same way, through lib/order-events.ts.
     */
    items: StoreOrderItemHookPayload[];
}

export {};
