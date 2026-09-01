import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `safeCall` is the only thing standing between a buggy third-party module and
 * a 500 on a core route, so the contract worth pinning is narrow and absolute:
 * it never throws, and it never lets its own audit logging become the failure.
 */

const activityLogCreate = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        activityLog: {
            create: (...args: unknown[]) => activityLogCreate(...args),
        },
    },
}));

import { safeCall } from "@/core/lib/module-sandbox";

describe("safeCall", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        activityLogCreate.mockReset();
        activityLogCreate.mockResolvedValue({});
        // The sandbox logs every module failure by design; keep it out of the
        // test output without hiding whether it was called.
        consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        consoleError.mockRestore();
    });

    it("returns the value when the module behaves", async () => {
        const result = await safeCall("blog", "search", () => "ok", "fallback");
        expect(result).toBe("ok");
        expect(activityLogCreate).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
    });

    it("awaits an async module function", async () => {
        const result = await safeCall("blog", "search", async () => 42, 0);
        expect(result).toBe(42);
    });

    it("returns the fallback when the module throws synchronously", async () => {
        const result = await safeCall(
            "blog",
            "search",
            () => {
                throw new Error("boom");
            },
            "fallback",
        );
        expect(result).toBe("fallback");
    });

    it("returns the fallback when the module rejects", async () => {
        const result = await safeCall("blog", "search", async () => {
            throw new Error("boom");
        }, [] as string[]);
        expect(result).toEqual([]);
    });

    it("records the failure against the module that caused it", async () => {
        await safeCall("store", "checkout", () => {
            throw new Error("boom");
        }, null);

        expect(activityLogCreate).toHaveBeenCalledTimes(1);
        const arg = activityLogCreate.mock.calls[0][0] as {
            data: { action: string; entityId: string; metadata: Record<string, unknown> };
        };
        expect(arg.data.action).toBe("module.runtime.error");
        expect(arg.data.entityId).toBe("store");
        expect(arg.data.metadata.operation).toBe("checkout");
        expect(arg.data.metadata.error).toBe("boom");
    });

    // A stack trace can be hundreds of frames; the whole thing in a JSON column
    // on every module error is how an activity log becomes the biggest table in
    // the database.
    it("truncates the recorded stack", async () => {
        await safeCall("store", "checkout", () => {
            throw new Error("boom");
        }, null);
        const metadata = (activityLogCreate.mock.calls[0][0] as { data: { metadata: { stack?: string } } })
            .data.metadata;
        expect(metadata.stack).toBeDefined();
        expect(metadata.stack!.split("\n").length).toBeLessThanOrEqual(5);
    });

    it("stringifies a module that throws a non-Error", async () => {
        await safeCall("store", "checkout", () => {
            throw "just a string";
        }, null);
        const metadata = (activityLogCreate.mock.calls[0][0] as { data: { metadata: Record<string, unknown> } })
            .data.metadata;
        expect(metadata.error).toBe("just a string");
        expect(metadata.stack).toBeUndefined();
    });

    // The failure mode this guards against: the database is down, the module
    // throws, and the audit write throws too — turning a contained module bug
    // into an unhandled rejection in the request pipeline.
    it("still returns the fallback when the audit write itself fails", async () => {
        activityLogCreate.mockRejectedValue(new Error("database is down"));
        const result = await safeCall("store", "checkout", () => {
            throw new Error("boom");
        }, "fallback");
        expect(result).toBe("fallback");
    });

    it("does not swallow the fallback when the module returns undefined", async () => {
        const result = await safeCall<string | undefined>("blog", "search", () => undefined, "fallback");
        expect(result).toBeUndefined();
    });
});
