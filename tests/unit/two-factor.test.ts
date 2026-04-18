import { describe, it, expect } from "vitest";
import { generateBackupCodes, hashBackupCode, verifyBackupCode } from "@/core/lib/two-factor";

describe("backup codes", () => {
    it("generates the requested number of codes", () => {
        const { codes, hashed } = generateBackupCodes(10);
        expect(codes).toHaveLength(10);
        expect(hashed).toHaveLength(10);
    });

    it("produces 64-bit readable codes (XXXX-XXXX-XXXX-XXXX)", () => {
        const { codes } = generateBackupCodes(5);
        for (const code of codes) {
            expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
        }
    });

    it("produces unique codes", () => {
        const { codes } = generateBackupCodes(20);
        const set = new Set(codes);
        expect(set.size).toBe(20);
    });

    it("hashes codes deterministically and dash-insensitively", () => {
        expect(hashBackupCode("ABCD-1234")).toBe(hashBackupCode("ABCD1234"));
        expect(hashBackupCode("abcd-1234")).toBe(hashBackupCode("ABCD-1234"));
    });

    it("verifies a valid code and removes it from the remaining list", () => {
        const { codes, hashed } = generateBackupCodes(3);
        const result = verifyBackupCode(codes[1], hashed);
        expect(result.valid).toBe(true);
        expect(result.remaining).toHaveLength(2);
        expect(result.remaining).not.toContain(hashed[1]);
    });

    it("rejects an invalid code without mutating the list", () => {
        const { hashed } = generateBackupCodes(3);
        const result = verifyBackupCode("BAAD-C0DE-DEAD-BEEF", hashed);
        expect(result.valid).toBe(false);
        expect(result.remaining).toEqual(hashed);
    });

    it("rejects reuse of the same code (single-use)", () => {
        const { codes, hashed } = generateBackupCodes(2);
        const first = verifyBackupCode(codes[0], hashed);
        expect(first.valid).toBe(true);
        const second = verifyBackupCode(codes[0], first.remaining);
        expect(second.valid).toBe(false);
    });
});
