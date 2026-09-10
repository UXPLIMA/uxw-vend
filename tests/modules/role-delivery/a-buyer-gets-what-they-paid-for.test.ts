/**
 * Handing a rank over when a listing sells.
 *
 * The market moves credits and takes a cut and has no idea what is being
 * sold; whatever is installed says what it can deliver. Nothing could, so the
 * whole module was inert - a seller could not write a listing because there
 * was no kind to give it. This is the first thing that can.
 *
 * A rank is not a file. Handing one over changes what the buyer holds, and
 * putting it back thirty days later means having remembered what they held
 * before. Three ways that goes wrong, and each of them ends with somebody
 * paying and getting nothing or keeping something for ever.
 *
 * A role that has been deleted since the listing was written. The market asks
 * again at the moment of sale for exactly this reason, and answering "handled"
 * for a role that is not there is a sale nobody unpicks until the buyer
 * complains.
 *
 * A buyer who already holds the rank, permanently, because an operator gave it
 * to them. Selling them thirty days of it has two possible endings and both
 * are wrong: they keep it for ever, or the sweep takes away a promotion the
 * operator made. So it is refused before any credits move, which is the one
 * moment a refusal costs nothing.
 *
 * And a buyer who holds it already with time left. Twenty-five days remaining
 * plus thirty bought is fifty-five. Anything that starts the clock again is
 * taking money for days it then deletes.
 */
import { describe, it, expect } from "vitest";
import { planGrant } from "@/modules/role-delivery/lib/grant-plan";

const NOW = new Date("2026-09-10T12:00:00Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

const world = { existingRoleIds: new Set(["gold", "silver", "member"]) };
const wanted = { roleId: "gold", days: 30 };

describe("a rank that can be handed over", () => {
    it("is granted, and remembers what the buyer held", () => {
        const plan = planGrant(wanted, { roleId: "member" }, null, world, NOW);
        expect(plan).toEqual({
            create: { roleId: "gold", previousRoleId: "member", expiresAt: inDays(30) },
        });
    });

    it("remembers nothing when the buyer held nothing, which reads as the default", () => {
        const plan = planGrant(wanted, { roleId: null }, null, world, NOW);
        expect(plan).toEqual({
            create: { roleId: "gold", previousRoleId: null, expiresAt: inDays(30) },
        });
    });
});

describe("a rank that cannot", () => {
    it("refuses a role that is not there any more", () => {
        expect(planGrant({ roleId: "bronze", days: 30 }, { roleId: "member" }, null, world, NOW))
            .toEqual({ refuse: "unknown_role" });
    });

    it("refuses a role named as nothing at all", () => {
        expect(planGrant({ roleId: "  ", days: 30 }, { roleId: "member" }, null, world, NOW))
            .toEqual({ refuse: "unknown_role" });
    });

    it("refuses a length of time that is not one", () => {
        for (const days of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(planGrant({ roleId: "gold", days }, { roleId: "member" }, null, world, NOW))
                .toEqual({ refuse: "bad_duration" });
        }
    });

    it("refuses a buyer who already holds it and holds it for good", () => {
        // No grant behind it, so nothing is going to take it away. Selling
        // them time would either be free money or a demotion later.
        expect(planGrant(wanted, { roleId: "gold" }, null, world, NOW))
            .toEqual({ refuse: "already_held" });
    });
});

describe("buying more time", () => {
    it("adds it to what is left rather than starting again", () => {
        expect(planGrant(wanted, { roleId: "gold" }, { expiresAt: inDays(25) }, world, NOW))
            .toEqual({ extend: { roleId: "gold", expiresAt: inDays(55) } });
    });

    it("starts from now when the old grant has already lapsed", () => {
        expect(planGrant(wanted, { roleId: "member" }, { expiresAt: inDays(-3) }, world, NOW))
            .toEqual({ extend: { roleId: "gold", expiresAt: inDays(30) } });
    });

    it("says extend rather than handing back a memory to overwrite", () => {
        // Extending must not touch what the row already remembers, and one
        // shape with a nullable field would have meant both "put back the
        // default" and "leave it alone".
        for (const holder of [{ roleId: "gold" }, { roleId: "member" }, { roleId: null }]) {
            const plan = planGrant(wanted, holder, { expiresAt: inDays(5) }, world, NOW);
            expect(plan).not.toHaveProperty("create");
        }
    });

    it("never records the granted role as the one to put back", () => {
        // That is the shape that makes a rank permanent by accident: the
        // sweep sees the member already holds what it was going to restore
        // and writes nothing, for ever.
        for (const holder of [{ roleId: "member" }, { roleId: null }, { roleId: "silver" }]) {
            const plan = planGrant(wanted, holder, null, world, NOW);
            if (!("create" in plan)) continue;
            expect(plan.create.previousRoleId).not.toBe("gold");
        }
    });
});
