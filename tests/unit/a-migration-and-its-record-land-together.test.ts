// @vitest-environment node
/**
 * A migration and the row that says it ran are one write or neither.
 *
 * The runner applied the SQL inside a transaction and then, as a separate
 * statement, created the `ModuleMigration` row that records it. A process that
 * died in between - a deploy restarting the container, a dropped connection,
 * an operator's Ctrl-C - left the schema changed and nothing saying so, and
 * the next run applied the same file again.
 *
 * For an additive migration written with IF NOT EXISTS that is survivable. For
 * anything else it is not: a second `ALTER TABLE ... ADD COLUMN` fails and
 * aborts the whole module, and a data migration that adds to a column applies
 * twice. The store's own settlement code carries the same lesson in a comment,
 * and this is the same shape one layer down.
 *
 * Postgres does DDL inside a transaction, so both belong in the one that is
 * already open. The test that proves it has to watch which client each write
 * went through: reaching for the module-level client inside a transaction
 * callback runs outside the transaction and looks identical in the source.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MigrationClient } from "../../scripts/apply-migrations";

interface Call {
    op: string;
    viaTx: boolean;
}

const calls: Call[] = [];
let ddlThrows: Error | null = null;
let recordThrows: Error | null = null;

function client(viaTx: boolean) {
    return {
        $executeRawUnsafe: async (sql: string) => {
            calls.push({ op: `sql:${sql.trim().slice(0, 20)}`, viaTx });
            if (ddlThrows) throw ddlThrows;
            return 1;
        },
        moduleMigration: {
            create: async () => {
                calls.push({ op: "moduleMigration.create", viaTx });
                if (recordThrows) throw recordThrows;
                return {};
            },
        },
    };
}

const tx = client(true);
const prisma = {
    ...client(false),
    // The real client rolls the callback's writes back together when it
    // throws; this stands in for that by letting the rejection through.
    $transaction: async <T>(run: (t: MigrationClient) => Promise<T>): Promise<T> => run(tx),
};

vi.mock("../../src/core/lib/db", () => ({ prisma, default: prisma }));
vi.mock("dotenv/config", () => ({}));

const { applyOneMigration } = await import("../../scripts/apply-migrations");

beforeEach(() => {
    calls.length = 0;
    ddlThrows = null;
    recordThrows = null;
});

const migration = {
    moduleId: "store",
    file: "003_a_product_carries_what_it_has_sold.sql",
    content: "ALTER TABLE \"Product\" ADD COLUMN \"unitsSold\" INTEGER NOT NULL DEFAULT 0;",
    checksum: "abc123",
};

describe("applying one migration", () => {
    it("runs the sql and records it through the same transaction", async () => {
        await applyOneMigration(prisma, migration);

        expect(calls.map((c) => c.op)).toEqual([
            'sql:ALTER TABLE "Product',
            "moduleMigration.create",
        ]);
        expect(calls.every((c) => c.viaTx), "both writes belong to the transaction").toBe(true);
    });

    it("records nothing when the sql fails", async () => {
        ddlThrows = new Error('relation "Product" does not exist');

        await expect(applyOneMigration(prisma, migration)).rejects.toThrow(/does not exist/);

        expect(calls.map((c) => c.op)).not.toContain("moduleMigration.create");
    });

    it("fails the migration when the record cannot be written", async () => {
        // The alternative is the bug this is here for: schema changed, nothing
        // saying so. Failing means the next run tries again from a database
        // the transaction put back.
        recordThrows = new Error("connection terminated");

        await expect(applyOneMigration(prisma, migration)).rejects.toThrow(/connection terminated/);
    });

    it("reports how long the statement took", async () => {
        const ms = await applyOneMigration(prisma, migration);
        expect(typeof ms).toBe("number");
        expect(ms).toBeGreaterThanOrEqual(0);
    });
});
