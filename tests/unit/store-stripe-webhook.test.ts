// @vitest-environment node
/**
 * Unit tests for the store Stripe webhook receiver
 * (src/modules/store/api/webhooks/stripe/route.ts).
 *
 * The handler is exercised unmodified; we mock at the module boundary:
 *   - the store Stripe lib (getStripe / getStripeWebhookSecret) so we can
 *     inject a fake `stripe.webhooks.constructEvent`
 *   - @/core/lib/db (prisma) with in-memory order/payment/credit state
 *   - the store email + rcon libs and core discord sender (fire-and-forget)
 *
 * Coverage:
 *   (a) missing `stripe-signature` header  -> 400
 *   (b) constructEvent throwing            -> 400
 *   (c) checkout.session.completed         -> order COMPLETED + paymentId set
 *                                             + Payment row created
 *   (c') credit_purchase metadata          -> store credits granted
 *   (d) idempotency: replaying a completed order does not double-grant
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fake Stripe client: constructEvent is swappable per-test ──
const constructEvent = vi.fn();
vi.mock("@/modules/store/lib/stripe", () => ({
    getStripe: async () => ({ webhooks: { constructEvent } }),
    getStripeWebhookSecret: async () => "whsec_test",
}));

// ── Fire-and-forget side effects: no-op ──
vi.mock("@/modules/store/lib/email", () => ({
    sendOrderConfirmationEmail: vi.fn(async () => {}),
}));
vi.mock("@/modules/store/lib/rcon", () => ({
    deliverProduct: vi.fn(async () => {}),
}));
vi.mock("@/core/lib/discord", () => ({
    sendDiscordWebhook: vi.fn(async () => {}),
}));

// ── In-memory prisma ──
// Typed to accept arbitrary args so the `(...a) => fn(...a)` thunks below
// type-check (matches the api-key-auth.test.ts mock pattern).
const orderUpdate = vi.fn<(...a: unknown[]) => unknown>();
const orderFindUnique = vi.fn<(...a: unknown[]) => unknown>();
const chestCreate = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({}));
const ownedUpsert = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({}));
const paymentCreate = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({}));
const productCommandFindMany = vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []);
const userUpdate = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({}));
const creditCreate = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({}));

vi.mock("@/core/lib/db", () => ({
    prisma: {
        order: {
            update: (...a: unknown[]) => orderUpdate(...a),
            findUnique: (...a: unknown[]) => orderFindUnique(...a),
        },
        chestItem: { create: (...a: unknown[]) => chestCreate(...a) },
        ownedProduct: { upsert: (...a: unknown[]) => ownedUpsert(...a) },
        payment: { create: (...a: unknown[]) => paymentCreate(...a) },
        productCommand: { findMany: (...a: unknown[]) => productCommandFindMany(...a) },
        user: { update: (...a: unknown[]) => userUpdate(...a) },
        creditTransaction: { create: (...a: unknown[]) => creditCreate(...a) },
    },
}));

import { POST } from "@/modules/store/api/webhooks/stripe/route";
import { NextRequest } from "next/server";

function makeReq(opts: { signature?: string | null; body?: string } = {}): NextRequest {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.signature !== null) headers["stripe-signature"] = opts.signature ?? "sig_test";
    return new NextRequest("http://example.com/api/v1/webhook/stripe", {
        method: "POST",
        headers,
        body: opts.body ?? "{}",
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    productCommandFindMany.mockResolvedValue([]);
});

describe("stripe webhook: signature gate", () => {
    it("(a) returns 400 when the stripe-signature header is missing", async () => {
        const res = await POST(makeReq({ signature: null }));
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string };
        expect(json.error).toMatch(/missing signature/i);
        expect(constructEvent).not.toHaveBeenCalled();
    });

    it("(b) returns 400 when constructEvent throws (bad signature)", async () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        constructEvent.mockImplementation(() => {
            throw new Error("No signatures found matching the expected signature");
        });
        const res = await POST(makeReq());
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string };
        expect(json.error).toMatch(/invalid signature/i);
        errSpy.mockRestore();
    });
});

describe("stripe webhook: checkout.session.completed (order flow)", () => {
    it("(c) marks the order COMPLETED with the payment intent id and writes a Payment row", async () => {
        constructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_1",
                    payment_intent: "pi_123",
                    amount_total: 4200,
                    currency: "usd",
                    metadata: { orderId: "order-1", playerName: "Steve" },
                    customer_details: { email: "buyer@example.com" },
                },
            },
        });
        // Idempotency check sees a PENDING order, then the post-update fetch
        // returns the full order with items + user.
        orderFindUnique
            .mockResolvedValueOnce({ id: "order-1", status: "PENDING" })
            .mockResolvedValueOnce({
                id: "order-1",
                orderNumber: "ORD-1",
                userId: "user-1",
                total: 42,
                currency: "USD",
                metadata: { playerName: "Steve" },
                user: { email: "buyer@example.com", username: "Steve" },
                items: [{ productId: "prod-1", name: "VIP", quantity: 1, metadata: {} }],
            });
        orderUpdate.mockResolvedValue({});

        const res = await POST(makeReq());
        expect(res.status).toBe(200);

        // Order marked COMPLETED with the payment intent id.
        expect(orderUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "order-1" },
                data: expect.objectContaining({ status: "COMPLETED", paymentId: "pi_123" }),
            })
        );
        // Ownership granted.
        expect(chestCreate).toHaveBeenCalledTimes(1);
        expect(ownedUpsert).toHaveBeenCalledTimes(1);
        // Payment row recorded with amount in major units.
        expect(paymentCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    orderId: "order-1",
                    provider: "stripe",
                    providerId: "pi_123",
                    amount: 42, // 4200 / 100
                    status: "COMPLETED",
                }),
            })
        );
    });

    it("(d) idempotency: replaying an already-COMPLETED order does not double-grant", async () => {
        constructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_1",
                    payment_intent: "pi_123",
                    amount_total: 4200,
                    currency: "usd",
                    metadata: { orderId: "order-1" },
                },
            },
        });
        // Idempotency check finds the order ALREADY completed -> early return.
        orderFindUnique.mockResolvedValueOnce({ id: "order-1", status: "COMPLETED" });

        const res = await POST(makeReq());
        expect(res.status).toBe(200);
        const json = (await res.json()) as { received: boolean };
        expect(json.received).toBe(true);

        // No status flip, no grant, no payment row.
        expect(orderUpdate).not.toHaveBeenCalled();
        expect(chestCreate).not.toHaveBeenCalled();
        expect(ownedUpsert).not.toHaveBeenCalled();
        expect(paymentCreate).not.toHaveBeenCalled();
    });

    it("idempotency: a missing order short-circuits without grants", async () => {
        constructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: { object: { id: "cs_x", metadata: { orderId: "ghost" } } },
        });
        orderFindUnique.mockResolvedValueOnce(null);

        const res = await POST(makeReq());
        expect(res.status).toBe(200);
        expect(orderUpdate).not.toHaveBeenCalled();
        expect(chestCreate).not.toHaveBeenCalled();
    });
});

describe("stripe webhook: checkout.session.completed (credit purchase)", () => {
    it("(c') grants store credits and records a credit transaction", async () => {
        constructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_credit",
                    metadata: { type: "credit_purchase", userId: "user-1", creditAmount: "25" },
                },
            },
        });

        const res = await POST(makeReq());
        expect(res.status).toBe(200);

        expect(userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-1" },
                data: { creditBalance: { increment: 25 } },
            })
        );
        expect(creditCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: "user-1",
                    amount: 25,
                    type: "credit_purchase",
                }),
            })
        );
        // Credit branch breaks before touching the order path.
        expect(orderFindUnique).not.toHaveBeenCalled();
    });

    it("ignores a credit purchase with zero amount", async () => {
        constructEvent.mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_credit0",
                    metadata: { type: "credit_purchase", userId: "user-1", creditAmount: "0" },
                },
            },
        });
        const res = await POST(makeReq());
        expect(res.status).toBe(200);
        expect(userUpdate).not.toHaveBeenCalled();
        expect(creditCreate).not.toHaveBeenCalled();
    });
});
