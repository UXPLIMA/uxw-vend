/**
 * What stops an installation losing its last way in.
 *
 * The setup wizard creates exactly one admin, so on a fresh install that
 * account is the only thing that can reach the admin panel. Nothing checked
 * before taking its authority away. Measured against a production build: an
 * admin banned themselves and then demoted themselves to member, both 200, and
 * no code anywhere counts how many administrators are left.
 *
 * On a single-admin install that is a mis-click with no way back through any
 * screen the product ships. Recovery means opening the database by hand, which
 * for something distributed as an image is the difference between a bad
 * afternoon and a support ticket that cannot be answered.
 *
 * The rule is one question asked before the write: would this leave nobody
 * able to administer the site? Ban, demotion and deletion all reduce to it,
 * and so does an admin deleting their own account from the profile screen.
 *
 * "Able" means an account that is an admin, not banned and not deleted. A
 * banned admin cannot sign in, so counting one as cover would leave the same
 * locked-out install with a reassuring number in it.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { removalWouldStrandTheSite, type AdminStanding } from "@/core/lib/last-administrator";

const ACTIVE: AdminStanding = { isAdmin: true, isBanned: false, isDeleted: false };

describe("taking the authority of the only administrator", () => {
    it("is refused when they are the only one", () => {
        expect(removalWouldStrandTheSite(ACTIVE, 1)).toBe(true);
    });

    it("is allowed when somebody else can still get in", () => {
        expect(removalWouldStrandTheSite(ACTIVE, 2)).toBe(false);
    });
});

describe("an account that was not holding the site up anyway", () => {
    it("is not protected when it is not an admin", () => {
        expect(removalWouldStrandTheSite({ ...ACTIVE, isAdmin: false }, 1)).toBe(false);
    });

    it("is not protected when it is already banned", () => {
        // It is not one of the accounts that can sign in, so the count of
        // usable administrators does not include it and removing it changes
        // nothing about who is left.
        expect(removalWouldStrandTheSite({ ...ACTIVE, isBanned: true }, 1)).toBe(false);
    });

    it("is not protected when it is already deleted", () => {
        expect(removalWouldStrandTheSite({ ...ACTIVE, isDeleted: true }, 1)).toBe(false);
    });
});

describe("a count that cannot be trusted", () => {
    it("refuses rather than assumes, when the count says nobody at all", () => {
        // Zero usable admins while this one is usable means the count and the
        // row disagree. Refusing costs one confusing error; allowing it is the
        // outcome this exists to prevent.
        expect(removalWouldStrandTheSite(ACTIVE, 0)).toBe(true);
    });
});

/**
 * The gate. A fourth way to take an account's authority is a fourth place to
 * forget the question, and forgetting it is silent: the change succeeds, the
 * screen says so, and the install has locked itself out.
 */
describe("every path that takes an account's authority", () => {
    const ROOT = process.cwd();
    const WRITERS = [
        // Ban and demotion.
        "src/app/api/v1/users/[id]/route.ts",
        // Both deletions, admin-initiated and self-initiated, meet here.
        "src/core/lib/user-deletion.ts",
    ];

    it.each(WRITERS)("asks first: %s", (relative) => {
        const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
        expect(source).toContain("wouldStrandTheSite");
    });

    it("routes both deletions through the one place that asks", () => {
        // If a route ever soft-deletes by writing the column itself, the
        // check in user-deletion.ts is not on its path.
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name === "route.ts") {
                    const body = fs.readFileSync(full, "utf8");
                    // A write, not a `select: { isDeleted: true }`, which is
                    // how several routes read the flag they are checking.
                    if (/data:\s*\{[^}]*isDeleted:\s*true/.test(body)) {
                        offenders.push(path.relative(ROOT, full));
                    }
                }
            }
        };
        walk(path.join(ROOT, "src/app/api"));
        expect(offenders).toEqual([]);
    });
});
