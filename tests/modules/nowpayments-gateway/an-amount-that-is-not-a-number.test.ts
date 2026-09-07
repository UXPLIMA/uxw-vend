// @vitest-environment node
/**
 * A payment does not settle for an amount that is not a number.
 *
 * The IPN body was read and then cast to an interface, which is a promise to
 * the compiler and nothing at all at runtime. `Number(body.price_amount ?? 0)`
 * turns a string that is not a number into `NaN`, and `NaN` went into the
 * `payment.settled` context as the amount, past every consumer of that hook.
 *
 * The signature is checked, so this is not a stranger's payload. It is
 * whatever the provider sent, and the shapes a provider sends change. The
 * schema only names the fields this route reads: anything else it sends is
 * dropped rather than refused, because a webhook that rejects an unfamiliar
 * field is a webhook that loses payments the week the provider adds one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const applyFiltersAsync = vi.fn(async () => ({ handled: true, duplicate: false, error: null }));
vi.mock("@/core/sdk", () => ({
    applyFiltersAsync: (...args: unknown[]) => applyFiltersAsync(...(args as [])),
}));

vi.mock("@/core/sdk/server", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    readJsonBody: async (request: Request) => request.json(),
}));

vi.mock("@/modules/nowpayments-gateway/lib/nowpayments", () => ({
    getNowPaymentsConfig: async () => ({ ipnSecret: "test-secret" }),
    // The signature gate is not what this file is about, so it always agrees.
    ipnSignature: () => "matching-signature",
}));

const { POST } = await import("@/modules/nowpayments-gateway/api/ipn/route");
const { NextRequest } = await import("next/server");

function ipn(body: Record<string, unknown>) {
    return new NextRequest("http://example.com/api/v1/nowpayments/ipn", {
        method: "POST",
        headers: { "content-type": "application/json", "x-nowpayments-sig": "matching-signature" },
        body: JSON.stringify(body),
    });
}

const FINISHED = {
    order_id: "order-1",
    payment_id: "pay-1",
    payment_status: "finished",
    price_currency: "usd",
};

beforeEach(() => {
    vi.clearAllMocks();
    applyFiltersAsync.mockResolvedValue({ handled: true, duplicate: false, error: null });
});

describe("a finished payment", () => {
    it("settles for the amount it names", async () => {
        const res = await POST(ipn({ ...FINISHED, price_amount: 42.5 }));
        expect(res.status).toBe(200);
        const [, , context] = applyFiltersAsync.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>];
        expect(context.amount).toBe(42.5);
    });

    it("settles for an amount the provider sent as a string", async () => {
        const res = await POST(ipn({ ...FINISHED, price_amount: "42.5" }));
        expect(res.status).toBe(200);
        const [, , context] = applyFiltersAsync.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>];
        expect(context.amount).toBe(42.5);
    });

    it("does not settle for an amount that is not a number", async () => {
        const res = await POST(ipn({ ...FINISHED, price_amount: "quarante-deux" }));
        expect(applyFiltersAsync).not.toHaveBeenCalled();
        expect(res.status).toBe(400);
    });

    it("still settles when the provider sends a field this build has never seen", async () => {
        const res = await POST(ipn({ ...FINISHED, price_amount: 42.5, outcome_currency: "btc" }));
        expect(res.status).toBe(200);
        expect(applyFiltersAsync).toHaveBeenCalled();
    });
});
