/**
 * An installation that has been given a key presents it, and one that has not
 * behaves exactly as it did before.
 *
 * The second half is the one that matters: every install that exists has no
 * key, and the free catalogue must not change for any of them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/core/lib/installation-id", () => ({ installationId: async () => "install-1" }));

beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}"));
    delete process.env.BLYSIS_LICENCE_KEY;
});

afterEach(() => vi.unstubAllGlobals());

describe("fetching from the marketplace", () => {
    it("sends no licence header when no key is configured", async () => {
        const { marketplaceFetch } = await import("@/core/lib/marketplace-fetch");
        await marketplaceFetch("https://example.invalid/index.json");
        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.has("x-blysis-licence")).toBe(false);
    });

    it("sends the key and the installation it belongs to when one is", async () => {
        process.env.BLYSIS_LICENCE_KEY = "BLY-AAAA-BBBB-CCCC-DDDD";
        const { marketplaceFetch } = await import("@/core/lib/marketplace-fetch");
        await marketplaceFetch("https://example.invalid/index.json");
        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("x-blysis-licence")).toBe("BLY-AAAA-BBBB-CCCC-DDDD");
        expect(headers.get("x-blysis-installation")).toBe("install-1");
    });

    it("keeps the caller's own options", async () => {
        process.env.BLYSIS_LICENCE_KEY = "BLY-AAAA-BBBB-CCCC-DDDD";
        const { marketplaceFetch } = await import("@/core/lib/marketplace-fetch");
        await marketplaceFetch("https://example.invalid/index.json", { next: { revalidate: 300 } });
        expect(fetchMock.mock.calls[0]?.[1]?.next).toEqual({ revalidate: 300 });
    });

    it("keeps the caller's own options when there is no key either", async () => {
        const { marketplaceFetch } = await import("@/core/lib/marketplace-fetch");
        await marketplaceFetch("https://example.invalid/index.json", { next: { revalidate: 300 } });
        expect(fetchMock.mock.calls[0]?.[1]?.next).toEqual({ revalidate: 300 });
    });
});
