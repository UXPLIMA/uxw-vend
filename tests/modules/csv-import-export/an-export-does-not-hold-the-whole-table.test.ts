// @vitest-environment node
/**
 * An export hands rows out as it reads them.
 *
 * The route read every user row with every column into one array, mapped that
 * array into a second array of strings, and joined those into one more string
 * before a single byte reached the admin who asked. Measured on 100k users
 * producing a 10.6 MB file: 228.9 MB of peak heap, of which 128.5 MB was the
 * rows themselves - because nothing told findMany which columns were wanted,
 * so it also carried every user's bcrypt hash into the process.
 *
 * Selecting the seven columns the file actually has takes the peak to
 * 131.6 MB. Handing the rows out a page at a time takes it to 18.1 MB, and
 * keeps it there however many users the site has.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface UserRow {
    id: string;
    username: string;
    email: string;
    isBanned: boolean;
    creditBalance: number;
    createdAt: Date;
    role: { name: string } | null;
    password?: string;
}

let everyUser: UserRow[] = [];
const findMany = vi.fn<(args: Record<string, unknown>) => Promise<unknown[]>>();
const logActivity = vi.fn(async () => undefined);
let callerIsAdmin = true;

vi.mock("@/core/sdk/server", () => ({
    prisma: { user: { findMany: (args: Record<string, unknown>) => findMany(args) } },
    isAdmin: async () => callerIsAdmin,
    logActivity: (args: unknown) => logActivity(args as never),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/core/sdk/auth", () => ({ auth: async () => ({ user: { id: "admin1" } }) }));

const { GET } = await import("@/modules/csv-import-export/api/export/route");
const { NextRequest } = await import("next/server");

/** Honours skip/take/orderBy the way the database would. */
function servePages() {
    findMany.mockImplementation(async (args) => {
        const skip = (args.skip as number) ?? 0;
        const take = (args.take as number) ?? everyUser.length;
        const rows = [...everyUser].sort((a, b) => a.id.localeCompare(b.id));
        // Whatever the route asked not to see, it does not see.
        const select = args.select as Record<string, unknown> | undefined;
        return rows.slice(skip, skip + take).map((row) => {
            if (!select) return row;
            const out: Record<string, unknown> = {};
            for (const key of Object.keys(select)) out[key] = (row as Record<string, unknown>)[key];
            return out;
        });
    });
}

function user(n: number): UserRow {
    return {
        id: `u${String(n).padStart(4, "0")}`,
        username: `player_${n}`,
        email: `player${n}@example.com`,
        isBanned: false,
        creditBalance: n,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        role: { name: "user" },
        password: "$2a$10$averysecretbcrypthashthatmustnevertravel",
    };
}

async function exportCsv(type = "users") {
    const response = await GET(
        new NextRequest(`http://example.com/api/v1/admin/export?type=${type}`),
    );
    return { status: response.status, body: await response.text(), response };
}

beforeEach(() => {
    vi.clearAllMocks();
    callerIsAdmin = true;
    everyUser = [];
    servePages();
});

describe("the user export", () => {
    it("never asks the database for the password column", async () => {
        everyUser = [user(1)];
        const { body } = await exportCsv();

        for (const call of findMany.mock.calls) {
            const select = call[0].select as Record<string, unknown> | undefined;
            expect(select, "the export has to name the columns it wants").toBeTruthy();
            expect(Object.keys(select!)).not.toContain("password");
        }
        expect(body).not.toContain("bcrypt");
    });

    it("reads a page at a time rather than the whole table", async () => {
        everyUser = Array.from({ length: 2500 }, (_, i) => user(i));
        await exportCsv();

        expect(findMany).toHaveBeenCalled();
        for (const call of findMany.mock.calls) {
            expect(call[0].take, "every read is bounded").toBeTypeOf("number");
        }
        expect(findMany.mock.calls.length).toBeGreaterThan(1);
    });

    it("orders the pages, so no row is read twice or skipped", async () => {
        everyUser = Array.from({ length: 2500 }, (_, i) => user(i));
        await exportCsv();

        expect(findMany.mock.calls[0][0].orderBy).toBeTruthy();
    });

    it("still writes one line per user, under the same header", async () => {
        everyUser = [user(1), user(2)];
        const { body } = await exportCsv();

        const lines = body.trim().split("\n");
        expect(lines[0]).toBe("id,username,email,role,isBanned,creditBalance,createdAt");
        expect(lines).toHaveLength(3);
        expect(lines[1]).toContain("player_1");
        expect(lines[2]).toContain("player_2");
    });

    it("hands back every row when there are more than one page of them", async () => {
        everyUser = Array.from({ length: 2500 }, (_, i) => user(i));
        const { body } = await exportCsv();

        expect(body.trim().split("\n")).toHaveLength(2501);
    });

    it("still keeps a formula out of a spreadsheet cell", async () => {
        everyUser = [{ ...user(1), username: "=cmd|'/c calc'!A1" }];
        const { body } = await exportCsv();

        expect(body).toContain(`"'=cmd|'/c calc'!A1"`);
    });

    it("still records who exported what", async () => {
        everyUser = [user(1)];
        await exportCsv();

        expect(logActivity).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "admin1", action: "data_exported" }),
        );
    });

    it("still refuses a type it does not know, without reading anything", async () => {
        const { status } = await exportCsv("orders");

        expect(status).toBe(400);
        expect(findMany).not.toHaveBeenCalled();
    });

    it("is refused to a caller who is not an administrator", async () => {
        callerIsAdmin = false;
        expect((await exportCsv()).status).toBe(403);
    });
});
