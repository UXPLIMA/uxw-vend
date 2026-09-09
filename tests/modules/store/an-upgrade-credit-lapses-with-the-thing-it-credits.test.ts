/**
 * A lapsed purchase stops counting as owned.
 *
 * Checkout already prices an upgrade cumulatively: buy a dearer product in a
 * category where you own a cheaper one and you pay the difference. It decides
 * that from `OwnedProduct`, which until now had no end date - so once a product
 * could be sold for thirty days, the row that granted a discount would go on
 * granting it for ever. Somebody who bought VIP once in 2024 would buy VIP+ at
 * the difference in 2029.
 *
 * The rule is the same one the ownership itself follows: the end date is the
 * first moment without. This pins the filter that has to be in the query,
 * because a set built in JavaScript after the fact is a set that the next
 * caller forgets to build.
 */
import { describe, it, expect } from "vitest";
import { stillOwnedWhere } from "@/modules/store/lib/ownership";

const AT = new Date("2026-09-09T12:00:00Z");

describe("the ownerships checkout counts", () => {
    it("asks for this member's rows only", () => {
        expect(stillOwnedWhere("user-1", AT)).toMatchObject({ userId: "user-1" });
    });

    it("keeps the ones with no end date and the ones still running", () => {
        const where = stillOwnedWhere("user-1", AT) as {
            OR: ({ expiresAt: null } | { expiresAt: { gt: Date } })[];
        };
        expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: AT } }]);
    });
});
