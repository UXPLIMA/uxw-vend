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
 * Proven against the development server at the time: three thousand products,
 * twenty thousand completed orders, and one product with zero paid orders and
 * five thousand abandoned ones. It came back first.
 *
 * The first fix read the ranking from a `groupBy` filtered on paid orders.
 * That was correct and slow - complete before a page of it could be cut, 90 ms
 * against a shop with 150,000 order items - so the count now lives on the
 * product row as `unitsSold`, maintained at settlement and at refund. The
 * guarantee is the same one, kept somewhere cheaper: the ranking cannot see an
 * order nobody paid for, because nothing but a settlement writes to it.
 *
 * What this file defends is that the public list still asks the order table
 * nothing at all, whatever it is sorted by. `what-sells-is-counted-when-it-
 * sells.test.ts` covers the counter itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

    it("asks the order table nothing, whatever the sort", async () => {
        // The ranking cannot see an unpaid order because it does not read
        // orders at all any more: only a settlement writes to the counter.
        for (const sort of ["popular", "newest", "price_asc", "price_desc"]) {
            vi.clearAllMocks();
            await list(`sort=${sort}`);
            expect(groupBy, sort).not.toHaveBeenCalled();
        }
    });

    it("puts what has sold most first, and what has never sold last", async () => {
        await list("sort=popular");

        expect(findMany).toHaveBeenCalledTimes(1);
        const args = findMany.mock.calls[0][0] as { orderBy: unknown };
        // Newest first among the products that have sold the same amount,
        // which is where a product nobody has bought sits: zero, then newest.
        expect(args.orderBy).toEqual([{ unitsSold: "desc" }, { createdAt: "desc" }]);
    });

    it("shows only what is on the shelf, and pages it", async () => {
        await list("sort=popular&category=ranks");

        const args = findMany.mock.calls[0][0] as { where: Record<string, unknown>; take: number };
        expect(args.where).toMatchObject({ isActive: true, category: { slug: "ranks" } });
        expect(args.take).toBe(12);
    });

});
