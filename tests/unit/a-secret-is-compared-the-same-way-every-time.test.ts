import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { secretsMatch } from "@/core/lib/constant-time";

/**
 * Two places compare a secret a caller sent against one the server holds.
 *
 * `checkCsrf` accepts `x-internal-request` as a way past the origin check,
 * and the module status endpoint accepts the same header in place of an
 * admin session. Both did it with `===`, which stops at the first byte that
 * differs and so takes a different amount of time for a near miss than for a
 * wrong first character.
 *
 * This is hardening rather than a hole: guessing a random secret through
 * network timing is not a practical attack. It is also the standard this
 * codebase already sets everywhere else, `timingSafeEqual` for a webhook
 * signature, and these two were the only ones that did not meet it.
 *
 * The comparison is written by hand rather than taken from `node:crypto`
 * because `csrf.ts` is reached from the proxy, and the proxy is not a place
 * to depend on a Node builtin being available.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("comparing a secret", () => {
    it("accepts the right one", () => {
        expect(secretsMatch("s3cret-value", "s3cret-value")).toBe(true);
    });

    it("rejects a wrong one of the same length", () => {
        expect(secretsMatch("s3cret-value", "s3cret-valve")).toBe(false);
    });

    it("rejects one that is a prefix of the other", () => {
        expect(secretsMatch("s3cret", "s3cret-value")).toBe(false);
        expect(secretsMatch("s3cret-value-more", "s3cret-value")).toBe(false);
    });

    it("rejects an absent header rather than throwing", () => {
        expect(secretsMatch(null, "s3cret-value")).toBe(false);
        expect(secretsMatch(undefined, "s3cret-value")).toBe(false);
    });

    it("rejects everything when the server holds no secret", () => {
        // An empty expected value must not turn into "anything matches".
        expect(secretsMatch("", "")).toBe(false);
        expect(secretsMatch("anything", "")).toBe(false);
    });

    it("reads every character, so a near miss costs what a far miss costs", () => {
        // Not a timing measurement, which would be flaky. This pins the shape:
        // the loop covers the longer of the two rather than stopping early.
        const long = "a".repeat(64);
        const differsAtTheEnd = "a".repeat(63) + "b";
        expect(secretsMatch(differsAtTheEnd, long)).toBe(false);
    });
});

describe("the places that compare one", () => {
    const sites = [
        "src/core/lib/csrf.ts",
        "src/app/api/v1/modules/status/route.ts",
    ];

    it("do not use === on a header against a secret", () => {
        const offenders = sites.filter((rel) => {
            const body = fs.readFileSync(path.join(ROOT, rel), "utf8");
            return /(headerValue|headers\.get\([^)]*\))\s*===\s*\w*[Ss]ecret/.test(body);
        });
        expect(
            offenders,
            `These compare a caller's header against a server secret with ===:\n${offenders.join("\n")}`,
        ).toEqual([]);
    });

    it("reach for the shared comparison instead", () => {
        for (const rel of sites) {
            const body = fs.readFileSync(path.join(ROOT, rel), "utf8");
            expect(body, `${rel} should use secretsMatch`).toContain("secretsMatch");
        }
    });
});
