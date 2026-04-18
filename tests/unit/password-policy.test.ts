import { describe, it, expect } from "vitest";
import { checkPasswordPolicy, PASSWORD_POLICY } from "@/core/lib/password-policy";

describe("checkPasswordPolicy", () => {
    it("accepts a strong password", () => {
        expect(checkPasswordPolicy("CorrectHorse42").ok).toBe(true);
    });

    it("rejects non-string input", () => {
        const r = checkPasswordPolicy(undefined);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("too_short");
    });

    it("rejects passwords below the minimum", () => {
        const r = checkPasswordPolicy("Aa1short");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("too_short");
    });

    it("rejects passwords above the maximum", () => {
        const r = checkPasswordPolicy("A1" + "a".repeat(PASSWORD_POLICY.MAX_LENGTH));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("too_long");
    });

    it("requires an uppercase letter", () => {
        const r = checkPasswordPolicy("allsmall123");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("missing_upper");
    });

    it("requires a digit", () => {
        const r = checkPasswordPolicy("NoDigitsHere");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("missing_digit");
    });

    it("rejects common passwords", () => {
        const r = checkPasswordPolicy("Password123");
        // Password123 passes length+upper+digit but is in the common list.
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("too_common");
    });

    it("case-insensitive common-password match", () => {
        expect(checkPasswordPolicy("LETMEIN123").reason).toBe("too_common");
    });

    it("minimum length is at least 10", () => {
        expect(PASSWORD_POLICY.MIN_LENGTH).toBeGreaterThanOrEqual(10);
    });
});
