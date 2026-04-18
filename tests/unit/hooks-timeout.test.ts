import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    addAction,
    addFilter,
    doActionAsync,
    applyFiltersAsync,
    resetHooks,
} from "@/core/lib/hooks";

describe("hook listener timeout", () => {
    const originalTimeout = process.env.HOOK_LISTENER_TIMEOUT_MS;

    beforeEach(() => {
        process.env.HOOK_LISTENER_TIMEOUT_MS = "200";
        resetHooks();
    });

    afterEach(() => {
        if (originalTimeout === undefined) delete process.env.HOOK_LISTENER_TIMEOUT_MS;
        else process.env.HOOK_LISTENER_TIMEOUT_MS = originalTimeout;
        vi.restoreAllMocks();
    });

    it("returns quickly when an async action listener hangs", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        addAction("test.hang", () => new Promise((resolve) => setTimeout(resolve, 2_000)), {
            moduleId: "pathological",
        });

        let fastCalled = false;
        addAction("test.hang", () => { fastCalled = true; });

        const started = Date.now();
        await doActionAsync("test.hang", {});
        const elapsed = Date.now() - started;

        expect(elapsed).toBeLessThan(1_000);
        expect(fastCalled).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });

    it("passes the previous value down the filter chain when a listener times out", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        addFilter<string>("test.chain", (v) => v + "a");
        addFilter<string>(
            "test.chain",
            () => new Promise<string>((resolve) => setTimeout(() => resolve("never"), 2_000)),
            { moduleId: "slow" },
        );
        addFilter<string>("test.chain", (v) => v + "c");

        const result = await applyFiltersAsync<string>("test.chain", "");
        expect(result).toBe("ac");
    });
});
