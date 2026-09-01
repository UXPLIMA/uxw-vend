import { describe, it, expect } from "vitest";
import {
    EMAIL_VERIFY_EXPIRY,
    PASSWORD_RESET_EXPIRY,
    clampDuration,
    clampMinPasswordLength,
} from "@/core/lib/security-settings";
import { PASSWORD_POLICY } from "@/core/lib/password-policy";

describe("clampMinPasswordLength", () => {
    it("uses the built-in minimum when the setting is unset or unusable", () => {
        for (const raw of [undefined, null, "", "abc", NaN, {}, []]) {
            expect(clampMinPasswordLength(raw)).toBe(PASSWORD_POLICY.MIN_LENGTH);
        }
    });

    it("lets an admin tighten the requirement", () => {
        expect(clampMinPasswordLength(16)).toBe(16);
        expect(clampMinPasswordLength("16")).toBe(16);
    });

    it("refuses to weaken it below the built-in minimum", () => {
        // The stored value used to default to 6 in the admin form; honouring
        // that literally would silently downgrade every password check.
        expect(clampMinPasswordLength(6)).toBe(PASSWORD_POLICY.MIN_LENGTH);
        expect(clampMinPasswordLength(0)).toBe(PASSWORD_POLICY.MIN_LENGTH);
        expect(clampMinPasswordLength(-5)).toBe(PASSWORD_POLICY.MIN_LENGTH);
    });

    it("never exceeds the maximum bcrypt input length", () => {
        expect(clampMinPasswordLength(9999)).toBe(PASSWORD_POLICY.MAX_LENGTH);
    });

    it("rounds a fractional value down to a whole character count", () => {
        expect(clampMinPasswordLength(12.9)).toBe(12);
    });
});

describe("clampDuration", () => {
    it("falls back to the default for anything unusable", () => {
        for (const raw of [undefined, null, "", "soon", NaN, {}]) {
            expect(clampDuration(raw, PASSWORD_RESET_EXPIRY)).toBe(PASSWORD_RESET_EXPIRY.defaultValue);
        }
    });

    it("accepts a numeric string", () => {
        expect(clampDuration("30", PASSWORD_RESET_EXPIRY)).toBe(30);
    });

    it("clamps to the allowed range at both ends", () => {
        expect(clampDuration(1, PASSWORD_RESET_EXPIRY)).toBe(PASSWORD_RESET_EXPIRY.min);
        expect(clampDuration(999999, PASSWORD_RESET_EXPIRY)).toBe(PASSWORD_RESET_EXPIRY.max);
        expect(clampDuration(0, EMAIL_VERIFY_EXPIRY)).toBe(EMAIL_VERIFY_EXPIRY.min);
        expect(clampDuration(999999, EMAIL_VERIFY_EXPIRY)).toBe(EMAIL_VERIFY_EXPIRY.max);
    });

    it("keeps the documented defaults", () => {
        expect(PASSWORD_RESET_EXPIRY.defaultValue).toBe(60);
        expect(EMAIL_VERIFY_EXPIRY.defaultValue).toBe(24);
    });
});
