// @vitest-environment node
/**
 * The base currency is what the other rates are quoted in.
 *
 * The admin screen let it be edited like any other row, so it was possible to
 * save `base: "TRY"` with TRY's own rate left at 32.5 - one lira is worth
 * 32.5 lira - and every price on the site converted through that factor. It
 * was also possible to disable the base, leaving every price measured against
 * a currency the site does not offer. Neither is a state anyone chose; both
 * are what you get by editing the row above and forgetting the row below.
 *
 * The screen no longer offers those fields for the base, and the endpoint
 * normalises them anyway - a module's API is reachable by more than its own
 * screen.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn(async ({ create, update }: { create?: unknown; update?: unknown }) => update ?? create);

vi.mock("@/core/sdk/server", () => ({
    prisma: { setting: { findUnique: vi.fn(async () => null), upsert: (args: never) => upsert(args) } },
    isAdmin: vi.fn(async () => true),
    readJsonBody: vi.fn(async (request: Request) => request.json()),
}));
vi.mock("@/core/sdk/auth", () => ({
    auth: vi.fn(async () => ({ user: { id: "u1", role: "admin" } })),
}));

const { POST } = await import("@/modules/currency/api/route");

function post(body: unknown) {
    return POST(
        new Request("http://localhost/api/v1/currency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }) as never,
    );
}

const USD = { code: "USD", name: "US Dollar", symbol: "$", rate: 1, enabled: true };
const EUR = { code: "EUR", name: "Euro", symbol: "€", rate: 0.92, enabled: true };

beforeEach(() => {
    upsert.mockClear();
});

describe("the base currency is the unit", () => {
    it("stores a rate of 1 for the base, whatever was sent", async () => {
        const res = await post({ base: "USD", currencies: [{ ...USD, rate: 32.5 }, EUR] });
        expect(res.status).toBe(200);
        const saved = await res.json();
        expect(saved.currencies.find((c: { code: string }) => c.code === "USD").rate).toBe(1);
        // The other rates are the caller's business and are left alone.
        expect(saved.currencies.find((c: { code: string }) => c.code === "EUR").rate).toBe(0.92);
    });

    it("keeps the base enabled", async () => {
        const res = await post({ base: "USD", currencies: [{ ...USD, enabled: false }, EUR] });
        const saved = await res.json();
        expect(saved.currencies.find((c: { code: string }) => c.code === "USD").enabled).toBe(true);
    });

    it("refuses two currencies with the same code", async () => {
        const res = await post({ base: "USD", currencies: [USD, { ...EUR, code: "USD" }] });
        expect(res.status).toBe(400);
    });

    it("still refuses a base that is not in the list", async () => {
        const res = await post({ base: "GBP", currencies: [USD, EUR] });
        expect(res.status).toBe(400);
    });
});
