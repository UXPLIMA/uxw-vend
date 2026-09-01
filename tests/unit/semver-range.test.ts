import { describe, it, expect } from "vitest";
import { parseVersion, isValidRange, satisfiesRange } from "@/core/lib/semver-range";

describe("parseVersion", () => {
    it("parses a plain triple", () => {
        expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    });

    it("tolerates a v prefix, prerelease and build metadata", () => {
        expect(parseVersion("v2.0.0-beta.1+sha.abc")).toEqual([2, 0, 0]);
    });

    it("rejects partial and malformed versions", () => {
        for (const bad of ["1.2", "1", "", "x.y.z", "1.2.3.4", "not-a-version"]) {
            expect(parseVersion(bad), bad).toBeNull();
        }
    });
});

describe("isValidRange", () => {
    it("accepts every supported form", () => {
        const good = [
            "*", "x", "1.2.3", "=1.2.3", "1.2", "1", "1.2.x",
            "^1.2.3", "~1.2.3", "^0.2.3", "^1", "~1",
            ">=1.2.3", ">1.2.3", "<=2.0.0", "<2.0.0",
            ">=1.2.3 <2.0.0", "^1.0.0 || ^2.0.0", ">= 1.2.3",
        ];
        for (const r of good) expect(isValidRange(r), r).toBe(true);
    });

    it("rejects unparseable ranges rather than treating them as permissive", () => {
        const bad = ["", "   ", "abc", "^", ">=", "1.2.3 - 2.0.0", "^1.2.3 || garbage", "!=1.0.0"];
        for (const r of bad) expect(isValidRange(r), r).toBe(false);
    });
});

describe("satisfiesRange — caret", () => {
    it("allows minor and patch below the next major", () => {
        expect(satisfiesRange("1.2.3", "^1.2.3")).toBe(true);
        expect(satisfiesRange("1.9.9", "^1.2.3")).toBe(true);
        expect(satisfiesRange("2.0.0", "^1.2.3")).toBe(false);
        expect(satisfiesRange("1.2.2", "^1.2.3")).toBe(false);
    });

    it("follows npm pre-1.0 semantics", () => {
        // ^0.2.3 is confined to 0.2.x
        expect(satisfiesRange("0.2.9", "^0.2.3")).toBe(true);
        expect(satisfiesRange("0.3.0", "^0.2.3")).toBe(false);
        // ^0.0.3 is confined to that exact patch line
        expect(satisfiesRange("0.0.3", "^0.0.3")).toBe(true);
        expect(satisfiesRange("0.0.4", "^0.0.3")).toBe(false);
    });

    it("handles partial carets", () => {
        expect(satisfiesRange("1.7.0", "^1")).toBe(true);
        expect(satisfiesRange("2.0.0", "^1")).toBe(false);
        expect(satisfiesRange("0.2.9", "^0.2")).toBe(true);
        expect(satisfiesRange("0.3.0", "^0.2")).toBe(false);
    });
});

describe("satisfiesRange — tilde, comparators, exact", () => {
    it("confines tilde to the patch line when a minor is given", () => {
        expect(satisfiesRange("1.2.9", "~1.2.3")).toBe(true);
        expect(satisfiesRange("1.3.0", "~1.2.3")).toBe(false);
        expect(satisfiesRange("1.9.0", "~1")).toBe(true);
        expect(satisfiesRange("2.0.0", "~1")).toBe(false);
    });

    it("honours comparator operators", () => {
        expect(satisfiesRange("1.2.3", ">=1.2.3")).toBe(true);
        expect(satisfiesRange("1.2.3", ">1.2.3")).toBe(false);
        expect(satisfiesRange("2.0.0", "<=2.0.0")).toBe(true);
        expect(satisfiesRange("2.0.0", "<2.0.0")).toBe(false);
    });

    it("pins a fully-specified exact version", () => {
        expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
        expect(satisfiesRange("1.2.4", "1.2.3")).toBe(false);
        expect(satisfiesRange("1.2.4", "=1.2.3")).toBe(false);
    });

    it("treats a partial version as an X-range", () => {
        expect(satisfiesRange("1.2.9", "1.2")).toBe(true);
        expect(satisfiesRange("1.3.0", "1.2")).toBe(false);
        expect(satisfiesRange("1.9.9", "1")).toBe(true);
        expect(satisfiesRange("1.2.9", "1.2.x")).toBe(true);
    });
});

describe("satisfiesRange — composition", () => {
    it("ANDs space-separated comparators", () => {
        expect(satisfiesRange("1.5.0", ">=1.2.3 <2.0.0")).toBe(true);
        expect(satisfiesRange("2.0.1", ">=1.2.3 <2.0.0")).toBe(false);
        expect(satisfiesRange("1.0.0", ">=1.2.3 <2.0.0")).toBe(false);
    });

    it("ORs || alternatives", () => {
        expect(satisfiesRange("1.4.0", "^1.0.0 || ^2.0.0")).toBe(true);
        expect(satisfiesRange("2.4.0", "^1.0.0 || ^2.0.0")).toBe(true);
        expect(satisfiesRange("3.0.0", "^1.0.0 || ^2.0.0")).toBe(false);
    });

    it("matches anything for a wildcard", () => {
        for (const r of ["*", "x", "X"]) {
            expect(satisfiesRange("0.0.1", r), r).toBe(true);
            expect(satisfiesRange("99.9.9", r), r).toBe(true);
        }
    });
});

describe("satisfiesRange — prerelease ordering", () => {
    it("sorts a prerelease below its release", () => {
        expect(satisfiesRange("1.0.0-beta", ">=1.0.0")).toBe(false);
        expect(satisfiesRange("1.0.0", ">=1.0.0-beta")).toBe(true);
        expect(satisfiesRange("1.0.0-beta.2", ">=1.0.0-beta.1")).toBe(true);
        expect(satisfiesRange("1.0.0-alpha", ">=1.0.0-beta")).toBe(false);
    });

    it("ranks numeric prerelease identifiers below alphanumeric ones", () => {
        expect(satisfiesRange("1.0.0-1", "<1.0.0-alpha")).toBe(true);
    });
});

describe("satisfiesRange — failure mode", () => {
    it("fails closed on a malformed range instead of matching", () => {
        expect(satisfiesRange("1.2.3", "garbage")).toBe(false);
        expect(satisfiesRange("1.2.3", "")).toBe(false);
    });

    it("fails closed on a malformed version", () => {
        expect(satisfiesRange("not-a-version", "*")).toBe(false);
        expect(satisfiesRange("1.2", "^1.0.0")).toBe(false);
    });
});
