/**
 * A bundler may hand the same module to a page more than once.
 *
 * `useSiteSettings` already deduplicated: it kept the in-flight promise in a
 * module-level variable and handed it to every caller. That works while there
 * is one copy of the module. Code splitting put two copies of it on the
 * homepage, each with its own variable, and a hook written to fetch once
 * fetched five times. The same shape produced fifteen requests for the store
 * widgets' totals, because four widgets in four chunks each asked separately.
 *
 * A module-level variable is per copy; `globalThis` is per page. Sharing
 * there is what makes the deduplication survive whatever the bundler decides
 * to do with the file.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { sharedJson, peekShared, invalidateShared, SHARED_STATE_KEY } from "@/core/lib/shared-request";

describe("a shared request", () => {
    beforeEach(() => {
        invalidateShared();
        vi.restoreAllMocks();
    });

    it("fetches once for concurrent callers", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ value: 1 }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const [a, b, c] = await Promise.all([
            sharedJson("/api/x"), sharedJson("/api/x"), sharedJson("/api/x"),
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(a).toEqual({ value: 1 });
        expect(b).toBe(a);
        expect(c).toBe(a);
    });

    it("serves a later caller from cache without a second request", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 2 }) });
        vi.stubGlobal("fetch", fetchMock);

        await sharedJson("/api/y");
        await sharedJson("/api/y");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps different urls apart", async () => {
        const fetchMock = vi.fn().mockImplementation((url: string) =>
            Promise.resolve({ ok: true, json: async () => ({ url }) }));
        vi.stubGlobal("fetch", fetchMock);

        expect(await sharedJson("/api/a")).toEqual({ url: "/api/a" });
        expect(await sharedJson("/api/b")).toEqual({ url: "/api/b" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not cache a failure, so a retry is a real retry", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 3 }) });
        vi.stubGlobal("fetch", fetchMock);

        await expect(sharedJson("/api/z")).rejects.toThrow();
        expect(await sharedJson("/api/z")).toEqual({ value: 3 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("lets the payload choose its own freshness", async () => {
        // `/api/v1/public-settings` answers with the window it considers
        // itself fresh for, which an operator sets in the admin panel. A
        // fixed ttl here would quietly override that.
        const ttl = (d: { cacheSeconds: number }) => d.cacheSeconds * 1000;
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ cacheSeconds: 300 }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await sharedJson("/api/ttl", ttl);
        await sharedJson("/api/ttl", ttl);

        // Five minutes of freshness means the second caller is served from
        // the store rather than sent back out.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("can be read synchronously once it is known", async () => {
        // A component that already has the answer must be able to render it
        // on its first pass. Waiting a tick to discover a value that is
        // already in hand is a blank frame, and a blank frame is a layout
        // shift.
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 4 }) });
        vi.stubGlobal("fetch", fetchMock);

        expect(peekShared("/api/peek")).toBeUndefined();
        await sharedJson("/api/peek");
        expect(peekShared("/api/peek")).toEqual({ value: 4 });
    });

    it("shares through globalThis, not a module variable", () => {
        // This is the whole point: a second copy of this file, which a bundler
        // is free to create, has to find the same store.
        expect(Object.getOwnPropertySymbols(globalThis)).toContain(SHARED_STATE_KEY);
    });
});
