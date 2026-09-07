import { describe, it, expect } from "vitest";
import { MAX_PAGE, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, pageParams } from "@/core/lib/page-params";

/**
 * Two constants multiply into a third nobody declared.
 *
 * `MAX_PAGE` and `MAX_PAGE_SIZE` are each easy to argue about on their own -
 * a hundred thousand pages is past any list a person reads, a hundred rows is
 * a sensible page. Their product is the worst offset a query string can ask
 * the database for, and that is the number that costs something.
 *
 * Measured in Postgres on a 500k-row table with an index on the filter and the
 * sort, so the walk is as cheap as it can be:
 *
 *     offset          0     1.2 ms
 *     offset     12,000     3.4 ms
 *     offset    499,988   141.2 ms   (the whole table)
 *     offset  9,999,900   117.9 ms   (the ceiling; the table ran out first)
 *
 * The last two lines are the point. A deep page does not cost what its number
 * suggests, it costs a walk of the table, because a database cannot skip rows
 * that are not there. So the ceiling bounds the damage only until the table is
 * larger than it - and the existing note beside `MAX_PAGE`, that ten million
 * is "far inside what an OFFSET holds", is about the type rather than the time.
 *
 * This pins the product. Raising either constant on its own reads as harmless
 * and is not: doubling the page size doubles the deepest scan a stranger can
 * ask for, on a public endpoint that no rate limit covers.
 */

/** The deepest OFFSET a query string can produce today. */
const WORST_OFFSET = MAX_PAGE * MAX_PAGE_SIZE;

describe("how deep a page may go", () => {
    it("is a number somebody chose, not one two others multiplied into", () => {
        expect(
            WORST_OFFSET,
            "MAX_PAGE * MAX_PAGE_SIZE is the deepest scan a stranger can ask for; " +
                "if this has grown, say in the file why the new depth is worth it",
        ).toBeLessThanOrEqual(10_000_000);
    });

    it("stays inside what Postgres takes for an OFFSET", () => {
        // The bug this helper was written for: 1e20 survived Math.max(1, ...)
        // and the driver refused an OFFSET past a 32-bit integer.
        expect(WORST_OFFSET).toBeLessThan(2 ** 31 - 1);
    });

    it("is what the helper actually produces at the ceiling", () => {
        const params = new URLSearchParams({ page: "99999999999999999999", limit: "100000" });
        const { page, limit, skip } = pageParams(params);

        expect(page).toBe(MAX_PAGE);
        expect(limit).toBe(MAX_PAGE_SIZE);
        expect(skip).toBe(WORST_OFFSET - MAX_PAGE_SIZE);
    });

    it("still defaults to a page a person would read", () => {
        const { page, limit, skip } = pageParams(new URLSearchParams());

        expect({ page, limit, skip }).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE, skip: 0 });
    });
});
