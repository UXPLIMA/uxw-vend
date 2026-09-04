/**
 * Nothing in the store grants a product outside a transaction.
 *
 * The behaviour of the payment path is covered by
 * `tests/modules/store/fulfilment.test.ts`, which drives the real functions.
 * This is the cheap structural half, and it reaches the one grant path that
 * has no gateway behind it to drive: the free order at checkout (total <= 0),
 * which completed the order and then granted it a row at a time.
 *
 * A write that goes through the module-level `prisma` client is outside every
 * transaction by definition, however it is spelled and wherever it sits in the
 * file, so that is what this checks.
 */
import { describe, it, expect } from "vitest";

describe("the store's other grant paths", () => {
    // The free order at checkout (total <= 0) completes and grants without a
    // gateway ever being involved, so `settleOrder` above never sees it. It
    // had the same sequential shape, and the credits path beside it granted
    // two rows per line item inside the transaction that also held the lock
    // on the buyer's balance.
    //
    // A grant that runs through the module-level `prisma` is outside every
    // transaction by definition, so that is what this checks: nothing writes
    // a chest item or an ownership row except through a transaction client.
    const SOURCES = [
        "module-sources/store/api/checkout/route.ts",
        "module-sources/store/lib/fulfilment.ts",
    ];

    it("never grants through the module-level prisma client", async () => {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        const offenders: string[] = [];
        for (const rel of SOURCES) {
            const source = readFileSync(join(process.cwd(), rel), "utf-8");
            const WRITES = /^(create|createMany|upsert|update|updateMany|delete|deleteMany)$/;
            for (const m of source.matchAll(/(\w+)\.(chestItem|ownedProduct)\.(\w+)\(/g)) {
                if (m[1] !== "tx" && WRITES.test(m[3])) {
                    offenders.push(`${rel}: ${m[0]}`);
                }
            }
        }
        expect(
            offenders,
            `A grant outside a transaction leaves a paid order half-granted:\n${offenders.join("\n")}`,
        ).toEqual([]);
    });

    it("grants in one statement per table rather than one per line item", async () => {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        for (const rel of SOURCES) {
            const source = readFileSync(join(process.cwd(), rel), "utf-8");
            expect(source, `${rel} should not create chest items one at a time`).not.toMatch(
                /tx\.chestItem\.create\(/,
            );
            // The subscription grant is a single row, so an upsert is the
            // right statement there; what it may not be is one per item.
            expect(source, `${rel} should not upsert ownership per line item`).not.toMatch(
                /for\s*\([^)]*\)\s*\{[^}]*ownedProduct\.upsert\(/,
            );
        }
    });

    it("completes the free order inside the same transaction that grants it", async () => {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        const source = readFileSync(join(process.cwd(), "module-sources/store/api/checkout/route.ts"), "utf-8");
        const free = source.slice(source.indexOf("if (total <= 0) {"));
        const transaction = free.indexOf("$transaction");
        const complete = free.indexOf('status: "COMPLETED"');
        const grant = free.indexOf("chestItem.createMany");
        expect(transaction, "the free order path must open a transaction").toBeGreaterThan(-1);
        expect(complete).toBeGreaterThan(transaction);
        expect(grant).toBeGreaterThan(transaction);
    });
});
