/**
 * A role given for a while is taken back, and nothing else is.
 *
 * A member holds one role here, so handing one out for thirty days means
 * remembering what they held before and putting it back. The sweep that does
 * that runs unattended over every account on the site, which makes the two
 * ways it can be wrong expensive in opposite directions: leave a role in place
 * and somebody keeps what they stopped paying for; take the wrong one away and
 * an operator's own promotion is silently undone by a purchase from months ago.
 *
 * So the decision is a function of three things and nothing else - what was
 * granted, what the member holds now, and which roles still exist - and it is
 * pinned here before anything writes to a user row.
 */
import { describe, it, expect } from "vitest";
import { roleAfterLapse } from "@/core/lib/timed-roles";

const grant = { userId: "u1", roleId: "role-vip", previousRoleId: "role-member" };
const site = { defaultRoleId: "role-member", existingRoleIds: new Set(["role-member", "role-vip", "role-mod"]) };

describe("when a timed role lapses", () => {
    it("puts back what the member held before", () => {
        expect(roleAfterLapse(grant, { roleId: "role-vip" }, site)).toEqual({ roleId: "role-member" });
    });

    it("leaves a member alone who no longer holds the granted role", () => {
        // An operator promoted them, or a later purchase gave them something
        // else. Either way the grant is not what put them where they are, and
        // reverting would undo somebody else's decision.
        expect(roleAfterLapse(grant, { roleId: "role-mod" }, site)).toBeNull();
        expect(roleAfterLapse(grant, { roleId: null }, site)).toBeNull();
    });

    it("falls back to the site default when the old role has been deleted", () => {
        const deleted = { ...grant, previousRoleId: "role-gone" };
        expect(roleAfterLapse(deleted, { roleId: "role-vip" }, site)).toEqual({ roleId: "role-member" });
    });

    it("falls back to the site default when there was no old role", () => {
        // Somebody who registered before a default role existed, or whose row
        // was made by hand.
        const fromNothing = { ...grant, previousRoleId: null };
        expect(roleAfterLapse(fromNothing, { roleId: "role-vip" }, site)).toEqual({ roleId: "role-member" });
    });

    it("clears the role when even the default is gone", () => {
        const noDefault = { defaultRoleId: null, existingRoleIds: new Set(["role-vip"]) };
        expect(roleAfterLapse(grant, { roleId: "role-vip" }, noDefault)).toEqual({ roleId: null });
    });

    it("does nothing when putting back what they already hold", () => {
        // The granted role and the previous one are the same, which happens
        // when a member buys a rank they were given by hand. Writing the same
        // value is a write nobody needs and an audit line nobody can read.
        const sameAgain = { ...grant, previousRoleId: "role-vip" };
        expect(roleAfterLapse(sameAgain, { roleId: "role-vip" }, site)).toBeNull();
    });
});
