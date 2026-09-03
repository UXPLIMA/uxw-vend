// @vitest-environment node
/**
 * What a license key is made of.
 *
 * A key is read aloud over the phone, retyped from a printed invoice, and
 * pasted into software months after the sale. So the alphabet has to survive
 * a human, and the storage has to survive a database dump: a stolen table
 * should not hand anyone a working key.
 */
import { describe, it, expect, vi } from "vitest";

// The real ones need an app key in the environment; the properties under test
// here are about which value goes through them, not how they encrypt.
vi.mock("@/core/sdk/server", () => ({
    encryptSecret: (value: string) => `enc:${Buffer.from(value).toString("base64")}`,
    decryptSecret: (value: string) => Buffer.from(value.slice(4), "base64").toString("utf8"),
    prisma: {},
}));

const { generateKey, normalizeKey, hashKey, hashMachine, sealKey, unsealKey, keyHint } = await import(
    "@/modules/license-keys/lib/key"
);

describe("generateKey", () => {
    it("is four blocks of five characters", () => {
        expect(generateKey()).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
    });

    // The pairs people mistype when reading a key off a screen or an invoice.
    it("leaves out the characters that get confused for each other", () => {
        const sample = Array.from({ length: 300 }, () => generateKey()).join("");
        expect(sample).not.toMatch(/[IOLU]/);
    });

    it("does not repeat itself", () => {
        const keys = new Set(Array.from({ length: 500 }, () => generateKey()));
        expect(keys.size).toBe(500);
    });

    it("puts the prefix in front so a key says which product it belongs to", () => {
        expect(generateKey("PRO")).toMatch(/^PRO-[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
    });

    // An admin typing "pro edition!" should not produce a key with a space in
    // it that no customer can retype.
    it("cleans up a prefix an admin typed carelessly", () => {
        expect(generateKey("pro edition!")).toMatch(/^PROEDITI-/);
    });

    it("ignores an empty prefix rather than leaving a leading dash", () => {
        expect(generateKey("")).toMatch(/^[A-Z0-9]{5}-/);
        expect(generateKey(null)).toMatch(/^[A-Z0-9]{5}-/);
    });

    // Rejection sampling, not modulo folding: with 256 bytes over a 32-letter
    // alphabet, folding would make the first eight letters twice as likely.
    it("draws every letter about as often as every other", () => {
        const counts = new Map<string, number>();
        for (const char of Array.from({ length: 400 }, () => generateKey()).join("").replace(/-/g, "")) {
            counts.set(char, (counts.get(char) ?? 0) + 1);
        }
        expect(counts.size).toBe(32);
        const frequencies = [...counts.values()];
        // 8000 characters over 32 letters is 250 each; a folded alphabet would
        // put the low half near 333 and the high half near 167.
        expect(Math.min(...frequencies)).toBeGreaterThan(180);
        expect(Math.max(...frequencies)).toBeLessThan(320);
    });
});

describe("normalizeKey", () => {
    // These are all the same key as far as a customer is concerned.
    it("forgives case, spaces and missing dashes", () => {
        const canonical = normalizeKey("ABCDE-FGHJK-MNPQR-STVWX");
        expect(normalizeKey("abcde-fghjk-mnpqr-stvwx")).toBe(canonical);
        expect(normalizeKey("ABCDE FGHJK MNPQR STVWX")).toBe(canonical);
        expect(normalizeKey("ABCDEFGHJKMNPQRSTVWX")).toBe(canonical);
        expect(normalizeKey("  abcde_fghjk.mnpqr/stvwx  ")).toBe(canonical);
    });

    it("keeps two different keys different", () => {
        expect(normalizeKey("ABCDE-FGHJK")).not.toBe(normalizeKey("ABCDE-FGHJM"));
    });
});

describe("hashKey", () => {
    it("hashes what the customer meant, not what they typed", () => {
        expect(hashKey("abcde fghjk")).toBe(hashKey("ABCDE-FGHJK"));
    });

    it("does not contain the key", () => {
        const key = generateKey();
        expect(hashKey(key)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashKey(key)).not.toContain(normalizeKey(key).slice(0, 5));
    });
});

describe("hashMachine", () => {
    // A machine fingerprint identifies a customer's computer. The site has no
    // use for the value itself, only for telling two machines apart.
    it("keeps the fingerprint out of the database", () => {
        expect(hashMachine("MB-PRO-8817")).toMatch(/^[0-9a-f]{64}$/);
        expect(hashMachine("MB-PRO-8817")).not.toContain("8817");
    });

    it("tolerates the whitespace a client library adds", () => {
        expect(hashMachine(" MB-PRO-8817\n")).toBe(hashMachine("MB-PRO-8817"));
    });

    it("tells two machines apart", () => {
        expect(hashMachine("machine-a")).not.toBe(hashMachine("machine-b"));
    });
});

describe("sealKey", () => {
    // The owner has to be able to read their key back, so it cannot be stored
    // hashed only. Encrypted means a dumped table is not a bag of usable keys.
    it("round trips", () => {
        const key = generateKey("PRO");
        expect(unsealKey(sealKey(key))).toBe(key);
    });

    it("does not store the key in the clear", () => {
        const key = generateKey();
        expect(sealKey(key)).not.toContain(key);
    });
});

describe("keyHint", () => {
    it("is enough for support to match a key, and not enough to use one", () => {
        const key = "ABCDE-FGHJK-MNPQR-STVWX";
        expect(keyHint(key)).toBe("ABCDE-FGHJK");
        expect(hashKey(keyHint(key))).not.toBe(hashKey(key));
    });
});
