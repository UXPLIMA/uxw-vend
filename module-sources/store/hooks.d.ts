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

    /**
     * The payment contract.
     *
     * A payment gateway is a module, not a branch in this one. The store knows
     * how to price an order and what to do once it is paid for; it knows
     * nothing about Stripe, PayPal or iyzico, and asks through these six
     * filters instead.
     *
     * Filters rather than actions in both directions, deliberately. The store
     * asking "who can take money?" and "start this payment" are questions with
     * answers. The gateway saying "this was paid" is a question too: it needs
     * to know whether anybody recorded it, because a webhook that goes
     * unhandled must be failed so the provider retries rather than acknowledged
     * and lost. An action would throw that answer away.
     *
     * The shapes live here, in the store, even though gateways answer three of
     * them: every gateway depends on the store, so this file is always present,
     * and one published contract beats each gateway inventing its own.
     */
    interface UxwVendFilterPayloads {
        /** Which gateways can take this currency right now. */
        "payment.providers": PaymentProviderSummary[];
        /** Where to send the buyer, once a gateway has started the payment. */
        "payment.session": PaymentSessionResult;
        /** Whether anybody recorded the money that arrived. */
        "payment.settled": PaymentOutcome;
        /** Whether anybody cancelled the order the buyer walked away from. */
        "payment.voided": PaymentOutcome;
        /** Whether anybody recorded the money going back. */
        "payment.refunded": PaymentOutcome;
        /** Whether anybody recorded the change to the plan. */
        "subscription.changed": PaymentOutcome;
    }

    /** The other half of the same six filters: what each one is asked about. */
    interface UxwVendFilterContexts {
        "payment.providers": { currency: string };
        "payment.session": PaymentSessionRequest;
        "payment.settled": PaymentSettlement;
        "payment.voided": { kind: PaymentKind; reference: string; provider: string };
        "payment.refunded": { provider: string; providerRef: string; amount: number | null };
        /**
         * A recurring plan started, renewed, or ended. Separate from
         * `payment.settled` because a subscription has a life of its own: the
         * store keeps the record, the gateway keeps the plan.
         */
        "subscription.changed": SubscriptionChange;
    }

    /**
     * What the money is for: an order of products, a top-up of the wallet, or
     * a recurring plan.
     */
    type PaymentKind = "order" | "credits" | "subscription";

    interface PaymentProviderSummary {
        /** Matches the gateway module's own provider id, e.g. "stripe". */
        id: string;
        label: string;
        description?: string;
        /** A Lucide icon name, rendered by the checkout page. */
        icon?: string;
    }

    interface PaymentSessionRequest {
        /** Which gateway is being asked. Everyone else ignores the call. */
        provider: string;
        kind: PaymentKind;
        /** The order id, or the credit purchase id. Comes back on settlement. */
        reference: string;
        /** Major units, as the buyer sees it. Gateways convert to minor units. */
        amount: number;
        /** ISO 4217, uppercase. */
        currency: string;
        description: string;
        lines: { name: string; quantity: number; unitAmount: number }[];
        successUrl: string;
        cancelUrl: string;
        customer: { userId: string | null; email: string | null; name: string | null };
        /**
         * Set only when `kind` is "subscription". A gateway that cannot take
         * recurring payments leaves the call alone, and the checkout says so
         * rather than charging once for something sold as a plan.
         */
        recurring?: {
            interval: "month" | "year";
            intervalCount: number;
            /** The store product being subscribed to. */
            productId: string;
        };
        /** Carried through the provider and handed back on settlement. */
        metadata: Record<string, string>;
    }

    interface PaymentSessionResult {
        /** False when no installed gateway answers to that provider id. */
        handled: boolean;
        /** Where to send the buyer. Null when the gateway could not start. */
        redirectUrl: string | null;
        /** The gateway's own id for the payment, stored on the order. */
        reference: string | null;
        /** A message for the buyer when the gateway refused. */
        error: string | null;
    }

    interface PaymentSettlement {
        kind: PaymentKind;
        /** The reference the session was started with. */
        reference: string;
        provider: string;
        /** The gateway's id for the money that moved. */
        providerRef: string;
        amount: number;
        currency: string;
        metadata?: Record<string, string>;
    }

    interface SubscriptionChange {
        provider: string;
        /** The gateway's id for the plan. Unique per provider. */
        providerRef: string;
        userId: string;
        productId: string;
        /** "active", "past_due", "canceled", as the provider words it. */
        status: string;
        /** When the paid-for period runs out. Null when the plan has ended. */
        currentPeriodEnd: string | null;
        /** True when the plan is over and access should be withdrawn. */
        ended: boolean;
    }

    interface PaymentOutcome {
        /** False means nobody recorded this. A webhook should fail, not ack. */
        handled: boolean;
        /** True when this arrived twice; the caller should ack, not retry. */
        duplicate: boolean;
        error: string | null;
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
