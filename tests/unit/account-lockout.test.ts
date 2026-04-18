import { describe, it, expect } from "vitest";
import { getLockoutStatus } from "@/core/lib/account-lockout";

describe("getLockoutStatus", () => {
    it("unlocked when lockedUntil is null", () => {
        expect(getLockoutStatus({ lockedUntil: null })).toEqual({ locked: false });
    });

    it("unlocked when user is null", () => {
        expect(getLockoutStatus(null)).toEqual({ locked: false });
    });

    it("unlocked when lockedUntil is in the past", () => {
        const past = new Date(Date.now() - 5 * 60 * 1000);
        expect(getLockoutStatus({ lockedUntil: past })).toEqual({ locked: false });
    });

    it("locked when lockedUntil is in the future", () => {
        const future = new Date(Date.now() + 10 * 60 * 1000);
        const status = getLockoutStatus({ lockedUntil: future });
        expect(status.locked).toBe(true);
        expect(status.until).toBe(future.getTime());
    });
});
