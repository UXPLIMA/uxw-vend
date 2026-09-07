import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A list read newest first is indexed the way it is read.
 *
 * `where { owner } orderBy { createdAt: "desc" } take N` is the commonest
 * shape in the product, and an index on the owner alone only does half of it:
 * Postgres finds the rows, then sorts all of them to hand back twenty. The
 * cost grows with the owner's history and shows up on nobody's dev machine,
 * where the table has nine rows.
 *
 * Most tables that are read this way already carry the composite index.
 * `Message` has `(conversationId, createdAt)`, `Notification` has
 * `(userId, createdAt)`. The three below did not, and they are the ones that
 * grow without an end: a credit ledger, the comments under a popular
 * article, every form a visitor has ever submitted, and the keys a long-lived
 * account has been issued.
 *
 * The other thirty models that order by `createdAt` without an index are left
 * alone on purpose. Coupons, announcements, changelog entries and downloads
 * are lists an operator curates by hand, and sorting nine rows costs nothing.
 * An index has a write cost, so it is added where reads grow, not everywhere
 * the pattern appears.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

/** How a growing list is read, and the index that answers it in one pass. */
const READ_NEWEST_FIRST = [
    {
        schema: "module-sources/store/schema.prisma",
        model: "CreditTransaction",
        reads: "a member's credit ledger, newest twenty",
        index: ["userId", "createdAt"],
    },
    {
        schema: "module-sources/blog/schema.prisma",
        model: "BlogComment",
        reads: "the comments under one article, newest first",
        index: ["articleId", "createdAt"],
    },
    {
        schema: "module-sources/license-keys/schema.prisma",
        model: "LicenseKey",
        reads: "one customer's keys, newest page first",
        index: ["userId", "createdAt"],
    },
    {
        schema: "module-sources/custom-forms/schema.prisma",
        model: "CustomFormSubmission",
        reads: "every submission, newest first, a page at a time",
        index: ["createdAt"],
    },
];

/** The `@@index([...])` lists a model declares, in order. */
function declaredIndexes(schema: string, model: string): string[][] {
    const source = fs.readFileSync(path.join(ROOT, schema), "utf8");
    const block = new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
    expect(block, `${model} should be declared in ${schema}`).toBeTruthy();
    return [...block![1].matchAll(/@@index\(\[([^\]]+)\]/g)].map((m) =>
        m[1].split(",").map((c) => c.trim()),
    );
}

describe("a list read newest first", () => {
    for (const { schema, model, reads, index } of READ_NEWEST_FIRST) {
        it(`is indexed for how ${model} is read: ${reads}`, () => {
            const declared = declaredIndexes(schema, model);
            const matches = declared.some(
                (cols) => index.every((want, i) => cols[i] === want),
            );
            expect(
                matches,
                `${model} is read as (${index.join(", ")}) and declares ${JSON.stringify(declared)}`,
            ).toBe(true);
        });
    }

    it("ships a migration for each, so an install that already exists gets it too", () => {
        const missing: string[] = [];
        for (const { schema, model, index } of READ_NEWEST_FIRST) {
            const dir = path.join(ROOT, path.dirname(schema), "migrations");
            const sql = fs.existsSync(dir)
                ? fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n")
                : "";
            const named = new RegExp(`CREATE\\s+INDEX[\\s\\S]{0,120}"${model}"[\\s\\S]{0,120}${index[0]}`, "i");
            if (!named.test(sql)) missing.push(`${model} (${index.join(", ")})`);
        }
        expect(
            missing,
            `a new index only reaches a fresh install through the schema; an existing one needs the migration:\n${missing.join("\n")}`,
        ).toEqual([]);
    });
});
