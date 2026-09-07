// @vitest-environment node
/**
 * No read of `UserSession` is unbounded.
 *
 * The table used to be empty for everyone, so both reads of it - the profile's
 * device list and the staff module's "who is online" - could ask for every
 * matching row and get nothing back. It is written to on every sign-in now, and
 * a row lives until its token expires: up to thirty days for a session that
 * ticked "keep me signed in". Nothing dedupes a browser that signs in twice, so
 * the count grows with logins rather than with devices, and anyone holding the
 * password can grow it on purpose.
 *
 * The device list therefore takes the most recently active page of it, which is
 * what the screen shows anyway, and "who is online" asks the question from the
 * staff side - a handful of rows - rather than reading every live session of
 * every staff member to discard all but their ids.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Row {
    id: string;
    tokenId: string;
    userId: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    lastActiveAt: Date;
    createdAt: Date;
    expiresAt: Date;
    isRevoked: boolean;
}

const rows: Row[] = [];

interface FindManyArgs {
    where: { userId: string; isRevoked: boolean; expiresAt: { gt: Date } };
    orderBy?: { lastActiveAt: "desc" };
    take?: number;
}

/**
 * The table, and the rule it is there to defend: it refuses to be read without
 * a ceiling. A route that filters in JavaScript after reading everything would
 * pass a length assertion while leaving the defect in place.
 */
const userSession = {
    create: async ({ data }: { data: Partial<Row> & { tokenId: string; userId: string; expiresAt: Date } }) => {
        const now = new Date();
        const row = {
            id: `s${rows.length + 1}`,
            deviceInfo: null,
            ipAddress: null,
            userAgent: null,
            lastActiveAt: now,
            createdAt: now,
            isRevoked: false,
            ...data,
        } as Row;
        rows.push(row);
        return row;
    },
    updateMany: async () => ({ count: 0 }),
    findMany: async (args: FindManyArgs) => {
        if (args.take === undefined) {
            throw new Error("UserSession was read without a ceiling");
        }
        const found = rows.filter(
            (r) =>
                r.userId === args.where.userId &&
                r.isRevoked === args.where.isRevoked &&
                r.expiresAt.getTime() > args.where.expiresAt.gt.getTime(),
        );
        found.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
        return found.slice(0, args.take);
    },
};

vi.mock("@/core/lib/db", () => ({ prisma: { userSession }, default: { userSession } }));
vi.mock("@/core/lib/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "member" } }) }));
vi.mock("@/core/lib/logger", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const { recordSignIn, MAX_LISTED_DEVICES } = await import("@/core/lib/session-registry");
const { GET } = await import("@/app/api/v1/sessions/route");

const HOUR = 60 * 60 * 1000;

async function listed(): Promise<{ userAgent: string | null }[]> {
    const res = await GET();
    expect(res.status).toBe(200);
    return ((await res.json()) as { sessions: { userAgent: string | null }[] }).sessions;
}

/** `count` sign-ins, oldest first, each one minute more recently active. */
async function signInsFor(userId: string, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
        await recordSignIn({
            tokenId: `${userId}-token-${i}`,
            userId,
            expiresAt: new Date(Date.now() + 24 * HOUR),
            ipAddress: null,
            userAgent: `login-${i}`,
        });
        rows[rows.length - 1].lastActiveAt = new Date(Date.now() - (count - i) * 60_000);
    }
}

beforeEach(() => {
    rows.length = 0;
});

describe("the device list", () => {
    it("has a ceiling a login loop cannot lift", async () => {
        await signInsFor("u1", MAX_LISTED_DEVICES + 25);
        expect(await listed()).toHaveLength(MAX_LISTED_DEVICES);
    });

    it("keeps the devices the user was last on, which is what the screen is for", async () => {
        await signInsFor("u1", MAX_LISTED_DEVICES + 3);
        const shown = await listed();
        // The three oldest fall off, not the three newest.
        expect(shown[0].userAgent).toBe(`login-${MAX_LISTED_DEVICES + 2}`);
        expect(shown.map((s) => s.userAgent)).not.toContain("login-0");
    });

    it("shows every device when there are fewer than the ceiling", async () => {
        await signInsFor("u1", 3);
        expect(await listed()).toHaveLength(3);
    });

    it("is a number somebody chose, not a page size that grew by accident", () => {
        // Large enough that a real person with many devices sees all of them,
        // small enough that the response stays a screenful of JSON.
        expect(MAX_LISTED_DEVICES).toBeGreaterThanOrEqual(20);
        expect(MAX_LISTED_DEVICES).toBeLessThanOrEqual(100);
    });
});
