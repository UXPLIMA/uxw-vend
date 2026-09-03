import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The IP blocklist is consulted by middleware on every request, so it has
 * two ways to be catastrophic and they pull in opposite directions: a CIDR
 * that matches too widely locks the admin out of their own instance, and a
 * database outage that propagates would deny all traffic. The design chose
 * to fail open - that choice needs a test, or the next refactor will quietly
 * reverse it.
 */

let rows: { ip: string; scope: string; expiresAt: Date | null }[];
let findManyThrows: unknown = null;
let findManyCalls = 0;
let findManyArgs: unknown[] = [];
let createArgs: unknown = null;
let deleteArgs: unknown = null;

vi.mock("@/core/lib/db", () => ({
    prisma: {
        ipBlock: {
            findMany: async (args?: unknown) => {
                findManyCalls += 1;
                findManyArgs.push(args);
                if (findManyThrows) throw findManyThrows;
                return rows;
            },
            create: async (args: unknown) => {
                createArgs = args;
                return { id: "blk_1", ...(args as { data: object }).data };
            },
            delete: async (args: unknown) => {
                deleteArgs = args;
                return {};
            },
        },
    },
}));

type IpBlocks = typeof import("@/core/lib/ip-blocks");

async function load(): Promise<IpBlocks> {
    vi.resetModules();
    return import("@/core/lib/ip-blocks");
}

beforeEach(() => {
    rows = [];
    findManyThrows = null;
    findManyCalls = 0;
    findManyArgs = [];
    createArgs = null;
    deleteArgs = null;
    vi.spyOn(console, "error").mockImplementation(() => { });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("ipInCidr", () => {
    it("matches an address inside a /24", async () => {
        const { ipInCidr } = await load();
        expect(ipInCidr("192.168.1.7", "192.168.1.0/24")).toBe(true);
        expect(ipInCidr("192.168.2.7", "192.168.1.0/24")).toBe(false);
    });

    it("handles the boundary prefixes", async () => {
        const { ipInCidr } = await load();
        // /0 is everything - an admin typing it locks out the whole internet,
        // including themselves, and it must at least behave predictably.
        expect(ipInCidr("8.8.8.8", "0.0.0.0/0")).toBe(true);
        expect(ipInCidr("1.2.3.4", "1.2.3.4/32")).toBe(true);
        expect(ipInCidr("1.2.3.5", "1.2.3.4/32")).toBe(false);
    });

    it("matches on the masked network, not the literal digits", async () => {
        const { ipInCidr } = await load();
        // A /20 straddles the third octet: 10.0.16.x is out, 10.0.15.x is in.
        expect(ipInCidr("10.0.15.255", "10.0.0.0/20")).toBe(true);
        expect(ipInCidr("10.0.16.0", "10.0.0.0/20")).toBe(false);
    });

    it("does not overflow on a high first octet", async () => {
        const { ipInCidr } = await load();
        // 255.x shifts into the sign bit of a 32-bit int; an unsigned slip
        // here makes half the address space match the wrong network.
        expect(ipInCidr("255.255.255.255", "255.255.255.0/24")).toBe(true);
        expect(ipInCidr("255.255.255.255", "128.0.0.0/1")).toBe(true);
        expect(ipInCidr("127.255.255.255", "128.0.0.0/1")).toBe(false);
    });

    it("treats a value with no slash as an exact match", async () => {
        const { ipInCidr } = await load();
        expect(ipInCidr("1.2.3.4", "1.2.3.4")).toBe(true);
        expect(ipInCidr("1.2.3.5", "1.2.3.4")).toBe(false);
    });

    it.each(["1.2.3.4/33", "1.2.3.4/-1", "1.2.3.4/abc", "1.2.3.4/2.5", "notanip/24", "1.2.3/24"])(
        "returns false for the malformed CIDR %o",
        async (cidr) => {
            const { ipInCidr } = await load();
            expect(ipInCidr("1.2.3.4", cidr)).toBe(false);
        },
    );

    it("returns false when the address itself is malformed", async () => {
        const { ipInCidr } = await load();
        expect(ipInCidr("1.2.3.256", "1.2.3.0/24")).toBe(false);
        expect(ipInCidr("::1", "1.2.3.0/24")).toBe(false);
        expect(ipInCidr("1.2.3.04a", "1.2.3.0/24")).toBe(false);
    });
});

describe("isValidIpOrCidr", () => {
    it.each(["1.2.3.4", "0.0.0.0", "255.255.255.255", "10.0.0.0/8", "1.2.3.4/32", "0.0.0.0/0"])(
        "accepts %o",
        async (value) => {
            const { isValidIpOrCidr } = await load();
            expect(isValidIpOrCidr(value)).toBe(true);
        },
    );

    it.each(["", "   ", "1.2.3", "1.2.3.4.5", "1.2.3.256", "abc", "::1", "1.2.3.4/33", "1.2.3.4/x"])(
        "rejects %o",
        async (value) => {
            const { isValidIpOrCidr } = await load();
            expect(isValidIpOrCidr(value)).toBe(false);
        },
    );

    it("trims surrounding whitespace before validating", async () => {
        const { isValidIpOrCidr } = await load();
        expect(isValidIpOrCidr("  1.2.3.4  ")).toBe(true);
    });
});

describe("isIpBlocked", () => {
    it("returns false without consulting the database for an unknown ip", async () => {
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("", "all")).toBe(false);
        expect(await isIpBlocked("unknown", "all")).toBe(false);
        expect(findManyCalls).toBe(0);
    });

    it("blocks an exact address", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);
        expect(await isIpBlocked("1.2.3.5", "all")).toBe(false);
    });

    it("asks the database only for blocks that are still live", async () => {
        rows = [];
        const { isIpBlocked } = await load();
        await isIpBlocked("1.2.3.4", "all");

        expect(findManyArgs[0]).toMatchObject({
            where: { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
            select: { ip: true, scope: true, expiresAt: true },
        });
    });

    it("blocks an address inside a blocked range", async () => {
        rows = [{ ip: "10.0.0.0/8", scope: "all", expiresAt: null }];
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("10.4.5.6", "all")).toBe(true);
        expect(await isIpBlocked("11.4.5.6", "all")).toBe(false);
    });

    it("applies an 'all' block to every scope", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("1.2.3.4", "admin")).toBe(true);
        expect(await isIpBlocked("1.2.3.4", "api")).toBe(true);
    });

    it("keeps a scoped block inside its own scope", async () => {
        rows = [{ ip: "1.2.3.4", scope: "admin", expiresAt: null }];
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("1.2.3.4", "admin")).toBe(true);
        // Blocking someone from the admin UI must not take the public site
        // away from them too.
        expect(await isIpBlocked("1.2.3.4", "api")).toBe(false);
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(false);
    });

    it("ignores a block that has already expired", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: new Date(Date.now() - 1000) }];
        const { isIpBlocked } = await load();

        // The query filters on expiry too, but a row cached before it lapsed
        // is still in memory for up to a minute.
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(false);
    });

    it("honours a block that has not expired yet", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: new Date(Date.now() + 60_000) }];
        const { isIpBlocked } = await load();

        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);
    });

    it("caches the list for 60 seconds, then reloads", async () => {
        vi.useFakeTimers();
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { isIpBlocked } = await load();

        await isIpBlocked("9.9.9.9", "all");
        await isIpBlocked("9.9.9.9", "all");
        // Middleware calls this on every request; a query per request would
        // put the block list in the hot path of the whole site.
        expect(findManyCalls).toBe(1);

        vi.advanceTimersByTime(60_001);
        await isIpBlocked("9.9.9.9", "all");
        expect(findManyCalls).toBe(2);
    });

    it("fails open on a database error", async () => {
        findManyThrows = new Error("connection refused");
        const { isIpBlocked } = await load();

        // A Postgres outage must not deny every request on the site.
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(false);
    });

    it("keeps serving the last known list through an outage", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { isIpBlocked, invalidateIpBlockCache } = await load();
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);

        findManyThrows = new Error("connection refused");
        invalidateIpBlockCache();

        // Falling open all the way would hand a banned attacker the site back
        // the moment the database hiccuped.
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);
    });

    it("returns false when nothing is blocked", async () => {
        const { isIpBlocked } = await load();
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(false);
    });
});

describe("block administration", () => {
    it("stores a trimmed ip and invalidates the cache", async () => {
        rows = [];
        const { addBlock, isIpBlocked } = await load();
        await isIpBlocked("9.9.9.9", "all");
        expect(findManyCalls).toBe(1);

        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        await addBlock({ ip: "  1.2.3.4  " });

        expect(createArgs).toMatchObject({
            data: { ip: "1.2.3.4", scope: "all", reason: null, expiresAt: null, createdById: null },
        });
        // Without the invalidation a new block would take up to a minute to
        // take effect, which is a long time during an active abuse incident.
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);
        expect(findManyCalls).toBe(2);
    });

    it.each(["admin", "api"] as const)("keeps the %o scope", async (scope) => {
        const { addBlock } = await load();
        await addBlock({ ip: "1.2.3.4", scope });
        expect(createArgs).toMatchObject({ data: { scope } });
    });

    it("falls back to 'all' for an unrecognised scope", async () => {
        const { addBlock } = await load();
        await addBlock({ ip: "1.2.3.4", scope: "everything" });
        // Silently narrowing an unknown scope would create a block that
        // matches nothing and looks active in the admin UI.
        expect(createArgs).toMatchObject({ data: { scope: "all" } });
    });

    it("stores the reason, expiry and author when given", async () => {
        const expiresAt = new Date("2026-12-01T00:00:00.000Z");
        const { addBlock } = await load();
        await addBlock({ ip: "1.2.3.4", reason: "scraping", expiresAt, createdById: "usr_1" });

        expect(createArgs).toMatchObject({
            data: { reason: "scraping", expiresAt, createdById: "usr_1" },
        });
    });

    it("invalidates the cache on removal too", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { removeBlock, isIpBlocked } = await load();
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(true);

        rows = [];
        await removeBlock("blk_1");

        expect(deleteArgs).toEqual({ where: { id: "blk_1" } });
        // An unblocked address that stays blocked for another minute reads
        // as "the admin panel did nothing".
        expect(await isIpBlocked("1.2.3.4", "all")).toBe(false);
    });

    it("lists every block, newest first and unfiltered, for the admin UI", async () => {
        rows = [{ ip: "1.2.3.4", scope: "all", expiresAt: null }];
        const { listBlocks } = await load();

        expect(await listBlocks()).toEqual(rows);
        // Unlike the middleware read, this one must not filter out expired
        // rows - the admin needs to see and clear them.
        expect(findManyArgs[0]).toEqual({ orderBy: { createdAt: "desc" } });
    });
});
