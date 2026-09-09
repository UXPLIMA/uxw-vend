/**
 * An empty box on the product form means "no rule", never zero and never "".
 *
 * The form holds every field as a string because that is what an input gives
 * back, and the API takes numbers and nulls. The gap between them is where the
 * quiet defects live: `Number("")` is 0, and a duration of 0 days is a product
 * that lapses the instant it is bought, while a granted role of "" is a role
 * id that matches nothing and would be written over a real one.
 *
 * `availabilityPayload` already draws that line for the selling rules. This
 * draws the same one for what a purchase grants, before there are two forms
 * carrying it.
 */
import { describe, it, expect } from "vitest";
import { grantPayload, EMPTY_GRANT } from "@/modules/store/pages/admin/products/_fields/grant-payload";

describe("what the product form sends about a grant", () => {
    it("sends nothing at all when both boxes are empty", () => {
        expect(grantPayload(EMPTY_GRANT)).toEqual({ durationDays: null, grantsRoleId: null });
    });

    it("sends the duration as a number once one is typed", () => {
        expect(grantPayload({ ...EMPTY_GRANT, durationDays: "30" })).toMatchObject({
            durationDays: 30,
        });
    });

    it("reads a duration of zero as no duration, rather than as an instant lapse", () => {
        expect(grantPayload({ ...EMPTY_GRANT, durationDays: "0" })).toMatchObject({
            durationDays: null,
        });
    });

    it("sends the chosen role, and null for the everyone option", () => {
        expect(grantPayload({ ...EMPTY_GRANT, grantsRoleId: "role-vip" })).toMatchObject({
            grantsRoleId: "role-vip",
        });
        expect(grantPayload({ ...EMPTY_GRANT, grantsRoleId: "" })).toMatchObject({
            grantsRoleId: null,
        });
    });
});
