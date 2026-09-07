// @vitest-environment node
/**
 * Popularity counts orders somebody paid for.
 *
 * `?sort=popular` ordered by `orderItems: { _count: "desc" }`, which counts
 * every order item whatever became of the order - and checkout writes the
 * `Order` with `status: "PENDING"` before the buyer pays. So an abandoned
 * checkout raised a product's ranking for good, and anyone could put anything
 * at the top of the shop by starting checkouts and walking away.
 *
 * Proven against the development server before this was written: three
 * thousand products, twenty thousand completed orders, and one product with
 * zero paid orders and five thousand abandoned ones. It came back first.
 *
 * The store already knew the right answer - its admin stats group order items
 * with `where: { order: { status: "COMPLETED" } }` - so this is the public
 * list catching up with the rest of the product rather than a new policy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { popularWindow } from "@/modules/store/lib/popular-window";

const groupBy = vi.fn(async () => [] as { productId: string | null }[]);
const findMany = vi.fn(async () => [] as unknown[]);
const count = vi.fn(async () => 0);

vi.mock("@/core/sdk/server", () => ({
    prisma: {
        product: { findMany: (a: unknown) => findMany(a as never), count: (a: unknown) => count(a as never) },
        orderItem: { groupBy: (a: unknown) => groupBy(a as never) },
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    isAdmin: async () => false,
    pageParams: () => ({ page: 1, limit: 12, skip: 0, take: 12 }),
    readJsonBody: async (r: Request) => r.json(),
    sanitizeHtml: (v: string) => v,
}));
vi.mock("@/core/sdk/auth", () => ({ auth: async () => null }));

const { GET } = await import("@/modules/store/api/products/route");
const { NextRequest } = await import("next/server");

describe("a page of a popularity ranking", () => {
    const ranked = ["a", "b", "c", "d", "e"];

    it("is the ranked products, in order, while there are enough of them", () => {
        expect(popularWindow(ranked, 0, 3)).toEqual({ ids: ["a", "b", "c"], tailSkip: 0, tailTake: 0 });
    });

    it("keeps its place on a later page", () => {
        expect(popularWindow(ranked, 3, 2)).toEqual({ ids: ["d", "e"], tailSkip: 0, tailTake: 0 });
    });

    it("asks for what is left over once the ranked run out mid-page", () => {
        expect(popularWindow(ranked, 3, 4)).toEqual({ ids: ["d", "e"], tailSkip: 0, tailTake: 2 });
    });

    it("asks only for the remainder once the page starts past them", () => {
        expect(popularWindow(ranked, 7, 3)).toEqual({ ids: [], tailSkip: 2, tailTake: 3 });
    });

    it("asks for the remainder from the start when nothing has sold", () => {
        expect(popularWindow([], 0, 12)).toEqual({ ids: [], tailSkip: 0, tailTake: 12 });
    });

    it("asks for nothing when the page is past everything", () => {
        expect(popularWindow(ranked, 5, 0)).toEqual({ ids: [], tailSkip: 0, tailTake: 0 });
    });

    it("never asks for a negative slice, whatever the page number", () => {
        for (const skip of [0, 1, 4, 5, 6, 50, 10_000]) {
            const w = popularWindow(ranked, skip, 12);
            expect(w.tailSkip, `skip ${skip}`).toBeGreaterThanOrEqual(0);
            expect(w.tailTake, `skip ${skip}`).toBeGreaterThanOrEqual(0);
            expect(w.ids.length + w.tailTake, `skip ${skip}`).toBeLessThanOrEqual(12);
        }
    });
});

describe("the public product list, ranked by popularity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        groupBy.mockResolvedValue([]);
        findMany.mockResolvedValue([]);
        count.mockResolvedValue(0);
    });

    async function list(query: string) {
        return GET(new NextRequest(`http://example.com/api/v1/store/products?${query}`));
    }

    it("counts only orders somebody paid for", async () => {
        await list("sort=popular");

        expect(groupBy).toHaveBeenCalledTimes(1);
        expect(groupBy.mock.calls[0][0]).toMatchObject({
            where: { order: { status: "COMPLETED" } },
        });
    });

    it("narrows the ranking by the same filter it narrows the list with", async () => {
        await list("sort=popular&category=ranks");

        const where = (groupBy.mock.calls[0][0] as { where: { product?: Record<string, unknown> } }).where;
        expect(
            where.product,
            "a category should narrow what counts as popular, not just what is shown",
        ).toMatchObject({ isActive: true, category: { slug: "ranks" } });
    });

    it("asks nothing of the order table for any other sort", async () => {
        for (const sort of ["newest", "price_asc", "price_desc"]) {
            vi.clearAllMocks();
            await list(`sort=${sort}`);
            expect(groupBy, sort).not.toHaveBeenCalled();
        }
    });
});
