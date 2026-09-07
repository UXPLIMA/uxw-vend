import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The end-to-end suite signs in as an account that is not there.
 *
 * `tests/e2e/helpers/login.ts` falls back to `admin@uxwvend.com` / `admin`
 * when `E2E_ADMIN_*` is unset, under a comment saying the fallbacks are the
 * local dev values "so an existing workstation keeps working without setting
 * anything". `prisma/seed.ts` makes `admin@example.com` with the username
 * `uxwadmin`. They have not agreed for some time.
 *
 * CI is unaffected: its workflow sets `SEED_ADMIN_EMAIL` and `E2E_ADMIN_EMAIL`
 * to the same value, so both halves are told the same thing. It is a local run
 * that pays, and it pays twenty times: measured on 2026-09-07, the suite gave
 * 29 failures against this box and about twenty of them were specs that log in
 * first, each waiting fifteen seconds for a navigation that could never come.
 *
 * The password stays out of it. The seed generates a random one unless
 * `SEED_ADMIN_PASSWORD` says otherwise, so no fallback can be right; what the
 * helper can do is say so when the login does not take, which the bare
 * `waitForURL` timeout did not.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

const seed = fs.readFileSync(path.join(ROOT, "prisma/seed.ts"), "utf8");
const helper = fs.readFileSync(path.join(ROOT, "tests/e2e/helpers/login.ts"), "utf8");

/** `process.env.SEED_ADMIN_EMAIL ?? "admin@example.com"` -> the default. */
function fallbackOf(source: string, variable: string): string | null {
    const m = new RegExp(`process\\.env\\.${variable}\\s*\\?\\?\\s*["']([^"']+)["']`).exec(source);
    return m?.[1] ?? null;
}

describe("the account the end-to-end suite signs in as", () => {
    it("is the one the seed makes, by email", () => {
        const seeded = fallbackOf(seed, "SEED_ADMIN_EMAIL");
        const used = fallbackOf(helper, "E2E_ADMIN_EMAIL");
        expect(seeded, "prisma/seed.ts should default the admin email").toBeTruthy();
        expect(used, "the helper should default the admin email").toBeTruthy();
        expect(used).toBe(seeded);
    });

    it("is the one the seed makes, by username", () => {
        const seeded = /username:\s*["']([^"']+)["']/.exec(seed)?.[1];
        const used = fallbackOf(helper, "E2E_ADMIN_USERNAME");
        expect(seeded, "prisma/seed.ts should name the admin username").toBeTruthy();
        expect(used).toBe(seeded);
    });

    it("says what to set when the sign-in does not take", () => {
        // Twenty specs timing out on waitForURL said nothing about why. The
        // helper names the variables so the first failure is the last one.
        expect(helper).toMatch(/E2E_ADMIN_EMAIL/);
        expect(helper, "the failure should name what to set").toMatch(
            /catch|throw new Error/,
        );
    });
});
