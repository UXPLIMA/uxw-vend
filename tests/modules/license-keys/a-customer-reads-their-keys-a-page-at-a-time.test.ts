// @vitest-environment node
/**
 * A customer with a long history reads their keys a page at a time.
 *
 * This endpoint decrypts every row it returns, because a key is worth nothing
 * to its owner unless they can read it. An unbounded read therefore costs one
 * AES-GCM open per key the account has ever been issued, and a reseller
 * account accumulates those for years.
 *
 * Measured on 300k keys with one owner holding 2000 of them: the unbounded
 * read plans a bitmap scan and sorts all 2000 rows to build the answer, at 55
 * shared buffers. The same query with a limit, against `(userId, createdAt)`,
 * walks the index backward and stops: 5 buffers, and 1.050ms to 0.122ms. The
 * limit and the index only pay together - the index alone changed nothing,
 * because without a limit Postgres has to read every row regardless.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface KeyRow {
    id: string;
    keySealed: string;
    keyHint: string;
    productName: string | null;
    status: string;
    userId: string | null;
    maxActivations: number;
    expiresAt: Date | null;
    createdAt: Date;
}

const db = { keys: [] as KeyRow[] };
let signedInAs: string | null = "owner";

/** The subset of `findMany` this route uses, honouring cursor, order and take. */
const prismaMock = {
    licenseKey: {
        findMany: vi.fn(
            async (args: {
                where: { userId: string };
                take?: number;
                skip?: number;
                cursor?: { id: string };
            }) => {
                const rows = db.keys
                    .filter((k) => k.userId === args.where.userId)
                    .sort(
                        (a, b) =>
                            b.createdAt.getTime() - a.createdAt.getTime() ||
                            b.id.localeCompare(a.id),
                    );
                let from = 0;
                if (args.cursor) {
                    from = rows.findIndex((r) => r.id === args.cursor!.id) + (args.skip ?? 0);
                }
                const page = rows.slice(from);
                return (args.take === undefined ? page : page.slice(0, args.take)).map((r) => ({
                    ...r,
                    activations: [],
                }));
            },
        ),
    },
};

vi.mock("@/core/sdk/server", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    prisma: prismaMock,
    encryptSecret: (value: string) => `enc:${Buffer.from(value).toString("base64")}`,
    decryptSecret: (value: string) => Buffer.from(value.slice(4), "base64").toString("utf8"),
}));
vi.mock("@/core/sdk/auth", () => ({
    auth: async () => (signedInAs ? { user: { id: signedInAs } } : null),
}));

const { GET } = await import("@/modules/license-keys/api/licenses/route");
const { PAGE_SIZE } = await import("@/modules/license-keys/api/licenses/route");

/** `count` keys for `owner`, oldest first, so the newest carries the highest number. */
function seed(count: number, userId = "owner") {
    for (let i = 0; i < count; i++) {
        db.keys.push({
            id: `k${String(i).padStart(4, "0")}`,
            keySealed: `enc:${Buffer.from(`KEY-${i}`).toString("base64")}`,
            keyHint: "KEY",
            productName: "Product",
            status: "active",
            userId,
            maxActivations: 1,
            expiresAt: null,
            createdAt: new Date(2020, 0, 1, 0, i),
        });
    }
}

async function read(url = "http://localhost/api/v1/licenses") {
    const response = await GET(new Request(url) as never);
    return { status: response.status, body: await response.json() };
}

beforeEach(() => {
    db.keys = [];
    signedInAs = "owner";
    vi.clearAllMocks();
});

describe("a customer's key list", () => {
    it("hands back one page, not every key the account has ever held", async () => {
        seed(PAGE_SIZE * 3);
        const { body } = await read();
        expect(body.licenses).toHaveLength(PAGE_SIZE);
    });

    it("asks the database for one page too, rather than trimming in memory", async () => {
        seed(PAGE_SIZE * 3);
        await read();
        const args = prismaMock.licenseKey.findMany.mock.calls[0][0];
        expect(args.take).toBeLessThanOrEqual(PAGE_SIZE + 1);
    });

    it("says there is more to read, so nothing is silently dropped", async () => {
        seed(PAGE_SIZE + 1);
        const { body } = await read();
        expect(body.nextCursor).toBe(body.licenses[PAGE_SIZE - 1].id);
    });

    it("says there is no more when the page is the whole list", async () => {
        seed(PAGE_SIZE);
        const { body } = await read();
        expect(body.nextCursor).toBeNull();
    });

    it("continues from the cursor without repeating the row it names", async () => {
        seed(PAGE_SIZE + 5);
        const first = await read();
        const second = await read(
            `http://localhost/api/v1/licenses?cursor=${first.body.nextCursor}`,
        );
        expect(second.body.licenses).toHaveLength(5);
        const ids = new Set(first.body.licenses.map((l: { id: string }) => l.id));
        expect(second.body.licenses.some((l: { id: string }) => ids.has(l.id))).toBe(false);
        expect(second.body.nextCursor).toBeNull();
    });

    it("still reads newest first", async () => {
        seed(PAGE_SIZE + 5);
        const { body } = await read();
        expect(body.licenses[0].id).toBe(`k${String(PAGE_SIZE + 4).padStart(4, "0")}`);
    });

    it("still shows the owner their own key in the clear", async () => {
        seed(1);
        const { body } = await read();
        expect(body.licenses[0].key).toBe("KEY-0");
    });

    it("is refused to a caller who is not signed in", async () => {
        signedInAs = null;
        const { status } = await read();
        expect(status).toBe(401);
    });
});
