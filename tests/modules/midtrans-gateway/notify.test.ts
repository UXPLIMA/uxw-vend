// @vitest-environment node
/**
 * The Midtrans notification route, as a worked example of what every gateway
 * in this repo has to get right.
 *
 * Three things are being pinned down here, and they are the same three for
 * Stripe, PayTR or anyone else: a notification with a bad signature changes
 * nothing; a payment that is only provisionally captured grants nothing; and a
 * settlement nobody recorded answers with a failure, so the provider sends it
 * again rather than considering the money delivered.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const SERVER_KEY = "SB-Mid-server-test";

vi.mock("@/core/sdk/server", () => ({
    prisma: {
        setting: {
            findMany: async () => [
                { key: "midtrans_server_key", value: SERVER_KEY },
                { key: "midtrans_test_mode", value: "true" },
            ],
        },
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const applyFiltersAsync = vi.fn(async () => ({ handled: true, duplicate: false, error: null }));
vi.mock("@/core/sdk", () => ({ applyFiltersAsync: (...args: unknown[]) => applyFiltersAsync(...args) }));

const { POST } = await import("@/modules/midtrans-gateway/api/notify/route");
const { NextRequest } = await import("next/server");

function sign(orderId: string, statusCode: string, gross: string): string {
    return crypto.createHash("sha512").update(orderId + statusCode + gross + SERVER_KEY).digest("hex");
}

function notify(body: Record<string, unknown>) {
    return new NextRequest("http://example.com/api/v1/midtrans/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

function paid(overrides: Record<string, unknown> = {}) {
    const base = {
        order_id: "order-1",
        status_code: "200",
        gross_amount: "150000.00",
        transaction_status: "settlement",
        transaction_id: "mt-1",
        ...overrides,
    };
    return {
        ...base,
        signature_key: sign(
            String(base.order_id),
            String(base.status_code),
            String(base.gross_amount),
        ),
    };
}

function asked() {
    const call = applyFiltersAsync.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>];
    return { hook: call[0], context: call[2] };
}

beforeEach(() => {
    vi.clearAllMocks();
    applyFiltersAsync.mockResolvedValue({ handled: true, duplicate: false, error: null });
});

describe("signature", () => {
    it("settles a notification whose signature verifies", async () => {
        const res = await POST(notify(paid()));

        expect(res.status).toBe(200);
        expect(asked().hook).toBe("payment.settled");
        expect(asked().context).toMatchObject({
            reference: "order-1",
            provider: "midtrans",
            providerRef: "mt-1",
            amount: 150000,
            currency: "IDR",
        });
    });

    it("changes nothing when the signature does not verify", async () => {
        const res = await POST(notify({ ...paid(), signature_key: "0".repeat(128) }));

        expect(res.status).toBe(400);
        expect(applyFiltersAsync).not.toHaveBeenCalled();
    });

    // The amount is part of what was signed, so editing it invalidates the
    // notification rather than settling a cheaper order.
    it("changes nothing when the amount was edited after signing", async () => {
        const res = await POST(notify({ ...paid(), gross_amount: "1.00" }));

        expect(res.status).toBe(400);
        expect(applyFiltersAsync).not.toHaveBeenCalled();
    });
});

describe("what counts as paid", () => {
    it("grants on an accepted card capture", async () => {
        await POST(notify(paid({ transaction_status: "capture", fraud_status: "accept" })));
        expect(asked().hook).toBe("payment.settled");
    });

    // A capture still under fraud review is not money.
    it("grants nothing on a capture that is still being challenged", async () => {
        const res = await POST(notify(paid({ transaction_status: "capture", fraud_status: "challenge" })));

        expect(res.status).toBe(200);
        expect(applyFiltersAsync).not.toHaveBeenCalled();
    });

    it("cancels the order when the transaction expires", async () => {
        await POST(notify(paid({ transaction_status: "expire" })));
        expect(asked().hook).toBe("payment.voided");
    });

    it("reports a refund against the transaction that paid", async () => {
        await POST(notify(paid({ transaction_status: "refund" })));
        expect(asked().hook).toBe("payment.refunded");
        expect(asked().context).toMatchObject({ provider: "midtrans", providerRef: "mt-1" });
    });
});

describe("the answer Midtrans reads", () => {
    it("fails the notification when nothing settled the payment", async () => {
        applyFiltersAsync.mockResolvedValue({ handled: false, duplicate: false, error: null });

        const res = await POST(notify(paid()));

        // Midtrans repeats a notification it did not get a 200 for, which is
        // what keeps a paid order from staying pending forever.
        expect(res.status).toBe(500);
    });

    it("accepts a replay the store recognised as a duplicate", async () => {
        applyFiltersAsync.mockResolvedValue({ handled: true, duplicate: true, error: null });

        const res = await POST(notify(paid()));

        expect(res.status).toBe(200);
    });
});
