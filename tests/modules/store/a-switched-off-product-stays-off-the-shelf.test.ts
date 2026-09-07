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
 *
 * The listing was only half of it. `/api/v1/store/products/[id]` answers by
 * id, slug **or `number`**, and `number` is a sequential integer, so walking
 * 1, 2, 3 read every switched-off product the listing was careful to hide.
 * The shelf and the price tag have to agree.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn(async () => []);
const count = vi.fn(async () => 0);
const findFirst = vi.fn<(args: unknown) => Promise<unknown>>(async () => null);

/** Flipped by the tests that ask what an administrator is allowed to see. */
let callerIsAdmin = false;

vi.mock("@/core/sdk/server", () => ({
    prisma: {
        product: {
            findMany: (args: unknown) => findMany(args as never),
            count: (args: unknown) => count(args as never),
            findFirst: (args: unknown) => findFirst(args),
        },
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    isAdmin: async () => callerIsAdmin,
    readJsonBody: async (request: Request) => request.json(),
    pageParams: () => ({ page: 1, limit: 12, skip: 0, take: 12 }),
    sanitizeHtml: (value: string) => value,
}));
vi.mock("@/core/sdk/auth", () => ({
    auth: async () => (callerIsAdmin ? { user: { id: "admin1" } } : null),
}));

const productExists = (await import("@/modules/store/lib/route-exists")).default;
const { GET } = await import("@/modules/store/api/products/route");
const { GET: GET_ONE } = await import("@/modules/store/api/products/[id]/route");
const { NextRequest } = await import("next/server");

const SWITCHED_OFF = { id: "p9", slug: "withdrawn", number: 9, name: "Withdrawn", isActive: false };
const ON_SALE = { id: "p1", slug: "vip", number: 1, name: "VIP", isActive: true };

/** The single-product route, asked for `id` by a caller who is or is not admin. */
async function readOne(id: string) {
    const response = await GET_ONE(
        new NextRequest(`http://example.com/api/v1/store/products/${id}`),
        { params: Promise.resolve({ id }) },
    );
    return { status: response.status, body: await response.json() };
}

/** The `where` the route asked the database for. */
function askedFor(): Record<string, unknown> {
    const args = findMany.mock.calls[0]?.[0] as unknown as { where: Record<string, unknown> };
    return args.where;
}

beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    callerIsAdmin = false;
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

describe("the public product page", () => {
    it("does not hand a switched-off product to a visitor who guesses its number", async () => {
        findFirst.mockResolvedValue(SWITCHED_OFF);

        expect((await readOne("9")).status).toBe(404);
    });

    it("does not hand one over by slug either", async () => {
        findFirst.mockResolvedValue(SWITCHED_OFF);

        expect((await readOne("withdrawn")).status).toBe(404);
    });

    it("says the same thing it says for a product that never existed", async () => {
        findFirst.mockResolvedValue(SWITCHED_OFF);
        const hidden = await readOne("9");
        findFirst.mockResolvedValue(null);
        const absent = await readOne("does-not-exist");

        expect(hidden).toEqual(absent);
    });

    it("still answers for a product that is on sale", async () => {
        findFirst.mockResolvedValue(ON_SALE);

        const { status, body } = await readOne("vip");
        expect(status).toBe(200);
        expect(body.product.slug).toBe("vip");
    });

    // The admin edit screen loads a product from this very endpoint, and the
    // product an operator most needs to open is the one they switched off.
    it("hands a switched-off product to an administrator, who has to edit it", async () => {
        callerIsAdmin = true;
        findFirst.mockResolvedValue(SWITCHED_OFF);

        const { status, body } = await readOne("9");
        expect(status).toBe(200);
        expect(body.product.slug).toBe("withdrawn");
    });
});

describe("whether the product URL is a page at all", () => {
    // The router asks this before anything renders. Answering yes for a
    // switched-off product both walks a visitor into a page the API will
    // refuse, and answers the only question an enumerator was asking: which
    // of /store/product/1, /2, /3 name a real product.
    it("is no for a product an operator switched off", async () => {
        findFirst.mockResolvedValue(null);

        expect(await productExists({ params: ["product", "9"] })).toBe(false);
        expect(findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { isActive: true } });
    });

    it("is yes for one that is on sale", async () => {
        findFirst.mockResolvedValue({ id: "p1" });

        expect(await productExists({ params: ["product", "vip"] })).toBe(true);
    });

    it("is no when the URL names nothing at all", async () => {
        expect(await productExists({ params: [] })).toBe(false);
        expect(findFirst).not.toHaveBeenCalled();
    });
});
