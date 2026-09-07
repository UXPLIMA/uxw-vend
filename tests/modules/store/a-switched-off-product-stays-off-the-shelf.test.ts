// @vitest-environment node
/**
 * A product an operator switched off is not on the shelf.
 *
 * The public listing filtered to active products unless the caller asked for
 * `?all=true`, and nothing checked who was asking. Anyone could name the
 * parameter and read every product the shop had ever turned off: the seasonal
 * ones, the mispriced ones, the ones pulled after a complaint.
 *
 * It matters more since the listing became something a proxy in front of the
 * site may hold for thirty seconds. An answer that changes with a query
 * parameter is a separate cache entry, so the leak would have been cached and
 * served rather than merely computed.
 *
 * The admin screen that needs the full list has its own endpoint now, behind
 * an administrator check. This one is public, and it answers the same thing
 * however it is asked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn(async () => []);
const count = vi.fn(async () => 0);
vi.mock("@/core/sdk/server", () => ({
    prisma: { product: { findMany: (args: unknown) => findMany(args as never), count: (args: unknown) => count(args as never) } },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    isAdmin: async () => false,
    readJsonBody: async (request: Request) => request.json(),
    pageParams: () => ({ page: 1, limit: 12, skip: 0, take: 12 }),
}));
vi.mock("@/core/sdk/auth", () => ({ auth: async () => null }));

const { GET } = await import("@/modules/store/api/products/route");
const { NextRequest } = await import("next/server");

/** The `where` the route asked the database for. */
function askedFor(): Record<string, unknown> {
    const args = findMany.mock.calls[0]?.[0] as unknown as { where: Record<string, unknown> };
    return args.where;
}

beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
});

describe("the public product listing", () => {
    it("asks only for products that are on sale", async () => {
        await GET(new NextRequest("http://example.com/api/v1/store/products"));
        expect(askedFor()).toMatchObject({ isActive: true });
    });

    it("still asks only for those when a caller asks for everything", async () => {
        await GET(new NextRequest("http://example.com/api/v1/store/products?all=true"));
        expect(askedFor()).toMatchObject({ isActive: true });
    });

    it("keeps filtering when a category is named as well", async () => {
        await GET(new NextRequest("http://example.com/api/v1/store/products?all=true&category=ranks"));
        expect(askedFor()).toMatchObject({ isActive: true });
    });
});
