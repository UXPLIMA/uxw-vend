// @vitest-environment node
/**
 * A transaction does not settle for nothing.
 *
 * The notification body was cast to an interface rather than checked, and the
 * amount was read as `Number(grossAmount) || 0`. The `|| 0` swallows a value
 * that does not read as a number: a transaction whose `gross_amount` arrived
 * as anything unexpected settled, for zero, and looked like a paid order.
 *
 * The signature is checked first and over the raw values, so this is the
 * provider's payload rather than a stranger's. What it protects against is
 * the provider sending a shape this build cannot read, which is answered now
 * instead of being rounded down to nothing.
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

vi.mock("@/modules/midtrans-gateway/lib/midtrans", () => ({
    getMidtransConfig: async () => ({ serverKey: "test-key" }),
    fromOrderId: (id: string) => id,
    // The signature gate is not what this file is about, so it always agrees.
    notificationSignature: () => "matching-signature",
}));

const { POST } = await import("@/modules/midtrans-gateway/api/notify/route");
const { NextRequest } = await import("next/server");

function notify(body: Record<string, unknown>) {
    return new NextRequest("http://example.com/api/v1/midtrans/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

const SETTLED = {
    order_id: "order-1",
    status_code: "200",
    signature_key: "matching-signature",
    transaction_status: "settlement",
    transaction_id: "trx-1",
};

beforeEach(() => {
    vi.clearAllMocks();
    applyFiltersAsync.mockResolvedValue({ handled: true, duplicate: false, error: null });
});

describe("a settled transaction", () => {
    it("settles for the amount it names", async () => {
        const res = await POST(notify({ ...SETTLED, gross_amount: "150000.00" }));
        expect(res.status).toBe(200);
        const [, , context] = applyFiltersAsync.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>];
        expect(context.amount).toBe(150000);
    });

    it("does not settle for nothing when the amount does not read as money", async () => {
        const res = await POST(notify({ ...SETTLED, gross_amount: "one hundred" }));
        expect(applyFiltersAsync).not.toHaveBeenCalled();
        expect(res.status).toBe(400);
    });

    it("still settles when the provider sends a field this build has never seen", async () => {
        const res = await POST(notify({ ...SETTLED, gross_amount: "150000.00", merchant_id: "M1" }));
        expect(res.status).toBe(200);
        expect(applyFiltersAsync).toHaveBeenCalled();
    });
});
