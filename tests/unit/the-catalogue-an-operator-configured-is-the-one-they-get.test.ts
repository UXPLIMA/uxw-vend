/**
 * A configured marketplace is the catalogue, not a source of ZIPs.
 *
 * The admin marketplace read `module-marketplace/index.json` off disk first
 * and only fell back to the network, which is right for a checkout with no
 * marketplace of its own and wrong for every install that ships that file:
 * the operator set `BLYSIS_MARKETPLACE_BASE`, the ZIPs came from there, and
 * the list of what could be installed never did. The setting looked like it
 * worked because installing worked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
const readFile = vi.fn();

vi.mock("fs/promises", () => ({ default: { readFile }, readFile }));
vi.mock("@/core/lib/marketplace-fetch", () => ({
    marketplaceFetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

const REMOTE = {
    version: "1.0.0",
    updated: "2026-09-11",
    modules: [{ id: "from-the-registry", name: "From the registry", version: "1.0.0", zip: "from-the-registry.zip" }],
};
const LOCAL = {
    version: "1.0.0",
    updated: "2026-09-11",
    modules: [{ id: "from-the-disk", name: "From the disk", version: "1.0.0", zip: "from-the-disk.zip" }],
};

beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    readFile.mockReset();
    readFile.mockResolvedValue(JSON.stringify(LOCAL));
    fetchMock.mockResolvedValue({ ok: true, json: async () => structuredClone(REMOTE) });
    delete process.env.BLYSIS_MARKETPLACE_BASE;
    const { invalidateMarketplaceCache } = await import("@/app/api/v1/modules/marketplace/_cache");
    invalidateMarketplaceCache();
});

afterEach(() => {
    delete process.env.BLYSIS_MARKETPLACE_BASE;
});

describe("the module catalogue", () => {
    it("comes from the marketplace the operator configured", async () => {
        process.env.BLYSIS_MARKETPLACE_BASE = "https://registry.invalid";
        const { loadMarketplaceCatalog } = await import("@/app/api/v1/modules/marketplace/_catalog");
        const index = await loadMarketplaceCatalog();
        expect(index.modules.map((m) => m.id)).toEqual(["from-the-registry"]);
    });

    it("falls back to the copy on disk when that marketplace cannot be reached", async () => {
        process.env.BLYSIS_MARKETPLACE_BASE = "https://registry.invalid";
        fetchMock.mockRejectedValue(new Error("network"));
        const { loadMarketplaceCatalog } = await import("@/app/api/v1/modules/marketplace/_catalog");
        const index = await loadMarketplaceCatalog();
        expect(index.modules.map((m) => m.id)).toEqual(["from-the-disk"]);
    });

    it("still prefers the copy on disk when no marketplace was configured", async () => {
        // An install that was never pointed anywhere reads its own catalogue
        // without a network call, exactly as it did before.
        const { loadMarketplaceCatalog } = await import("@/app/api/v1/modules/marketplace/_catalog");
        const index = await loadMarketplaceCatalog();
        expect(index.modules.map((m) => m.id)).toEqual(["from-the-disk"]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
