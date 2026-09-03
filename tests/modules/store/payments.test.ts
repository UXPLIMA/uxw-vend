// @vitest-environment node
/**
 * The store's side of the payment contract: asking, never doing.
 *
 * These tests exist because the checkout page and the checkout route both
 * trust the answers - one to draw the buttons, the other to decide whether an
 * order can be paid for at all. A gateway that answers twice, or a request
 * built with the wrong return URL, breaks a checkout in a way no gateway test
 * would catch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const applyFiltersAsync = vi.fn();
vi.mock("@/core/sdk", () => ({ applyFiltersAsync: (...args: unknown[]) => applyFiltersAsync(...args) }));
vi.mock("@/core/sdk/server", () => ({ resolveAppUrl: async () => "https://shop.example.com" }));

const { listPaymentProviders, isPaymentProviderAvailable, startPaymentSession } = await import(
    "@/modules/store/lib/payments"
);

/** The context the store passed alongside the value it sent through the bus. */
function askedWith(index = 0) {
    const call = applyFiltersAsync.mock.calls[index] as unknown as [string, unknown, Record<string, unknown>];
    return call[2];
}

beforeEach(() => {
    applyFiltersAsync.mockReset();
});

describe("listPaymentProviders", () => {
    it("asks with the currency in the form gateways compare against", async () => {
        applyFiltersAsync.mockResolvedValue([]);
        await listPaymentProviders("try");
        expect(askedWith()).toEqual({ currency: "TRY" });
    });

    // Two buttons with the same id would post the same paymentMethod, and only
    // one of the two gateways would ever see the payment.
    it("keeps the first answer when two gateways claim one id", async () => {
        applyFiltersAsync.mockResolvedValue([
            { id: "stripe", label: "Card" },
            { id: "paypal", label: "PayPal" },
            { id: "stripe", label: "Card (again)" },
        ]);

        const providers = await listPaymentProviders("usd");

        expect(providers.map((p) => p.id)).toEqual(["stripe", "paypal"]);
        expect(providers[0].label).toBe("Card");
    });

    it("reports no providers at all on a site with no gateway installed", async () => {
        applyFiltersAsync.mockResolvedValue([]);
        expect(await listPaymentProviders("usd")).toEqual([]);
    });
});

describe("isPaymentProviderAvailable", () => {
    it("is true only for a gateway that answered for this currency", async () => {
        applyFiltersAsync.mockResolvedValue([{ id: "iyzico", label: "Kart" }]);

        expect(await isPaymentProviderAvailable("iyzico", "TRY")).toBe(true);
        expect(await isPaymentProviderAvailable("stripe", "TRY")).toBe(false);
    });
});

describe("startPaymentSession", () => {
    const input = {
        provider: "stripe",
        kind: "order" as const,
        reference: "order-1",
        amount: 42,
        currency: "usd",
        description: "Order ORD-1",
        lines: [{ name: "VIP", quantity: 1, unitAmount: 42 }],
        customer: { userId: "user-1", email: "buyer@example.com", name: "Steve" },
    };

    beforeEach(() => {
        applyFiltersAsync.mockResolvedValue({ handled: true, redirectUrl: "https://pay", reference: "cs_1", error: null });
    });

    it("builds absolute return URLs from the site's own address", async () => {
        await startPaymentSession(input);

        expect(askedWith()).toMatchObject({
            successUrl: "https://shop.example.com/store/order-success",
            cancelUrl: "https://shop.example.com/store/cart?order=cancelled",
        });
    });

    it("lets the caller send the buyer somewhere else afterwards", async () => {
        await startPaymentSession({ ...input, kind: "credits", successPath: "/credits?bought=1", cancelPath: "/credits" });

        expect(askedWith()).toMatchObject({
            successUrl: "https://shop.example.com/credits?bought=1",
            cancelUrl: "https://shop.example.com/credits",
        });
    });

    it("uppercases the currency and defaults the metadata to an empty bag", async () => {
        await startPaymentSession(input);
        expect(askedWith()).toMatchObject({ currency: "USD", metadata: {} });
    });

    // A plan that reached the gateway without its recurring half would be
    // charged once and never again, which is the worst of both outcomes.
    it("carries the recurring half of a subscription through to the gateway", async () => {
        await startPaymentSession({
            ...input,
            kind: "subscription",
            recurring: { interval: "month", intervalCount: 1, productId: "prod-1" },
        });

        expect(askedWith()).toMatchObject({
            kind: "subscription",
            recurring: { interval: "month", intervalCount: 1, productId: "prod-1" },
        });
    });

    it("leaves recurring off a one-off payment entirely", async () => {
        await startPaymentSession(input);
        expect(askedWith()).not.toHaveProperty("recurring");
    });

    // No gateway answering is a different failure from a gateway that tried
    // and could not, and the checkout route reports them with different codes.
    it("passes back the unhandled answer when no gateway owns that id", async () => {
        applyFiltersAsync.mockResolvedValue({ handled: false, redirectUrl: null, reference: null, error: null });

        const result = await startPaymentSession({ ...input, provider: "nobody" });

        expect(result.handled).toBe(false);
        expect(result.redirectUrl).toBeNull();
    });
});
