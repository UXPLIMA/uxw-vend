import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
            apiVersion: "2026-03-25.dahlia",
        });
    }
    return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_, prop) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (getStripe() as any)[prop];
    },
});

export function getStripeEnabled(): boolean {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY);
}
