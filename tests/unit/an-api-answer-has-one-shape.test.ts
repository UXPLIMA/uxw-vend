/**
 * The envelope every endpoint answers in, which nothing tested.
 *
 * `api-utils.ts` shapes every response the product sends: the success
 * envelope, the error envelope, the pagination block, the masking that keeps
 * a crashing Prisma call from putting a database hostname on the wire, and
 * the rate-limit wrapper that decides whether a caller is answered at all.
 * Coverage on the file was zero, so all of that was held up by the endpoints
 * that happen to use it and by nothing else.
 *
 * These are the guarantees a client is entitled to assume.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { apiSuccess, apiError, apiPaginated, devOnlyDetail } from "@/core/lib/api-utils";

async function body(res: Response): Promise<Record<string, unknown>> {
    return (await res.json()) as Record<string, unknown>;
}

describe("a success answer", () => {
    it("carries the data under ok", async () => {
        const res = apiSuccess({ id: 7 });
        expect(res.status).toBe(200);
        expect(await body(res)).toEqual({ ok: true, data: { id: 7 } });
    });

    it("keeps a chosen status and headers", async () => {
        const res = apiSuccess({ id: 1 }, 201, { "X-Test": "yes" });
        expect(res.status).toBe(201);
        expect(res.headers.get("X-Test")).toBe("yes");
    });

    it("does not invent a pagination block", async () => {
        expect(await body(apiSuccess([1, 2]))).not.toHaveProperty("pagination");
    });
});

describe("a failure answer", () => {
    it("says it failed and why", async () => {
        const res = apiError("Nope", 403);
        expect(res.status).toBe(403);
        expect(await body(res)).toEqual({ ok: false, error: "Nope" });
    });

    it("carries a machine code when one is given", async () => {
        expect(await body(apiError("Nope", 400, { code: "bad_input" })))
            .toEqual({ ok: false, error: "Nope", code: "bad_input" });
    });

    it("leaves absent details off the wire rather than sending null", async () => {
        // A client branching on `"details" in body` must not see a key that
        // exists only because the caller passed nothing.
        expect(await body(apiError("Nope"))).not.toHaveProperty("details");
    });

    it("keeps details that are falsy but present", async () => {
        expect(await body(apiError("Nope", 400, { details: null })))
            .toHaveProperty("details", null);
    });

    it("defaults to 400, not 200", async () => {
        expect(apiError("Nope").status).toBe(400);
    });
});

describe("a paginated answer", () => {
    const page = async (total: number, p: number, limit: number) =>
        (await body(apiPaginated([], total, p, limit))).pagination as Record<string, unknown>;

    it("counts the pages a total needs", async () => {
        expect(await page(25, 1, 10)).toMatchObject({ pages: 3, total: 25 });
    });

    it("reports one page for an empty list, never zero", async () => {
        // A client rendering "page 1 of 0" is worse than one rendering
        // "page 1 of 1" with nothing in it.
        expect(await page(0, 1, 10)).toMatchObject({ pages: 1 });
    });

    it("knows when there is more and when there is not", async () => {
        expect(await page(25, 1, 10)).toMatchObject({ hasMore: true });
        expect(await page(25, 3, 10)).toMatchObject({ hasMore: false });
        expect(await page(20, 2, 10)).toMatchObject({ hasMore: false });
    });

    it("survives a limit of zero without dividing by it", async () => {
        const p = await page(5, 1, 0);
        expect(Number.isFinite(p.pages)).toBe(true);
        expect(p.pages).toBe(5);
    });
});

describe("masking an internal error", () => {
    const original = process.env.NODE_ENV;
    afterEach(() => { vi.stubEnv("NODE_ENV", original ?? "test"); });

    it("says nothing in production, whatever it was handed", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(devOnlyDetail(new Error("connect ECONNREFUSED 10.0.0.5:5432"))).toBeUndefined();
        expect(devOnlyDetail("some string")).toBeUndefined();
    });

    it("gives the message elsewhere, so a developer can read it", () => {
        vi.stubEnv("NODE_ENV", "development");
        expect(devOnlyDetail(new Error("boom"))).toBe("boom");
        expect(devOnlyDetail("plain")).toBe("plain");
    });

    it("treats nothing as nothing rather than as the string null", () => {
        vi.stubEnv("NODE_ENV", "development");
        expect(devOnlyDetail(undefined)).toBeUndefined();
        expect(devOnlyDetail(null)).toBeUndefined();
    });
});

/**
 * The wrapper decides whether a caller is answered at all, so the thing worth
 * pinning is the shape of the key. It used to hit the limiter with the bare
 * IP, which gave every route one shared counter: a licence check from an
 * office spent the budget the people behind that NAT needed to sign in. The
 * scope is now required, and a test that only checked the 429 body would not
 * have noticed either way.
 */
describe("the rate limit wrapper", () => {
    it("counts each scope separately, and never keys on the request path", async () => {
        const keys: string[] = [];
        vi.resetModules();
        vi.doMock("@/core/lib/rate-limit", () => ({
            rateLimit: async (key: string) => {
                keys.push(key);
                return { success: true, remaining: 9, resetAt: Date.now() + 60_000 };
            },
            getClientIP: () => "203.0.113.7",
            rateLimits: { api: { limit: 10, windowMs: 60_000 } },
        }));

        const { withRateLimit: wrap } = await import("@/core/lib/api-utils");
        const { apiSuccess: ok } = await import("@/core/lib/api-utils");
        const handler = async () => ok({ done: true });

        const req = new Request("http://x/api/v1/users/42") as never;
        await wrap("users", handler)(req);
        await wrap("search", handler)(req);

        expect(keys).toEqual(["users:203.0.113.7", "search:203.0.113.7"]);
        // The id in the path must not reach the key, or a caller varying it
        // has no limit at all.
        expect(keys.some((k) => k.includes("42"))).toBe(false);
    });

    it("refuses with the standard envelope and the headers a client retries on", async () => {
        const resetAt = Date.now() + 30_000;
        vi.resetModules();
        vi.doMock("@/core/lib/rate-limit", () => ({
            rateLimit: async () => ({ success: false, remaining: 0, resetAt }),
            getClientIP: () => "203.0.113.7",
            rateLimits: { api: { limit: 10, windowMs: 60_000 } },
        }));

        const { withRateLimit: wrap } = await import("@/core/lib/api-utils");
        let handlerRan = false;
        const res = await wrap("users", async () => {
            handlerRan = true;
            return new Response() as never;
        })(new Request("http://x/api/v1/users") as never);

        expect(handlerRan, "a refused caller must not reach the handler").toBe(false);
        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ ok: false, code: "rate_limited" });
        expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(res.headers.get("Retry-After")).not.toBeNull();
    });
});
