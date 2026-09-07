// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The store's product pages were not in the sitemap.
 *
 * Core builds `/sitemap.xml` from a list of static routes plus whatever each
 * enabled module contributes through `seoRoutes`, and four modules
 * contribute: blog, forum, help-center and trophies. The store did not, so
 * `/store` and `/store/vip` were listed and not one product was, while a
 * product page answers 200 to an anonymous request. Measured on this install:
 * forty sitemap entries, all of them reachable, none of them a product, with
 * two active products in the database.
 *
 * A product is the store's indexable content in the way an article is the
 * blog's, so it contributes the same way, and the same way round: only what
 * the public page would actually show.
 */

let products: { slug: string; updatedAt: Date }[] = [];
const findMany = vi.fn(async () => products);

vi.mock("@/core/sdk/server", () => ({
    prisma: { product: { findMany: (args: unknown) => findMany(args as never) } },
}));

async function sitemap() {
    const mod = await import("@/modules/store/seo/sitemap");
    return mod.default();
}

describe("the store's contribution to the sitemap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        products = [];
    });

    it("is one entry per product, at the address the page has", async () => {
        products = [
            { slug: "vip-membership", updatedAt: new Date("2026-01-02T03:04:05Z") },
            { slug: "1000-credits", updatedAt: new Date("2026-02-03T04:05:06Z") },
        ];
        const entries = await sitemap();
        expect(entries.map((e) => e.url)).toEqual([
            "/store/product/vip-membership",
            "/store/product/1000-credits",
        ]);
    });

    it("carries when the product last changed, so a crawler can skip it", async () => {
        const updatedAt = new Date("2026-01-02T03:04:05Z");
        products = [{ slug: "vip-membership", updatedAt }];
        expect((await sitemap())[0].lastModified).toEqual(updatedAt);
    });

    it("asks only for what the shelf shows", async () => {
        await sitemap();
        const args = findMany.mock.calls[0][0] as { where: Record<string, unknown>; take?: number };
        expect(args.where).toMatchObject({ isActive: true });
        expect(args.take, "an unbounded list is a page nobody can serve").toBeGreaterThan(0);
    });

    it("says nothing rather than failing when the query does", async () => {
        findMany.mockRejectedValueOnce(new Error("database is away"));
        await expect(sitemap()).resolves.toEqual([]);
    });
});
