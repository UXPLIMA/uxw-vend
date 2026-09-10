/**
 * How long a machine credential keeps the authority it was issued with.
 *
 * Only an admin can create an API key, and the one endpoint that accepts one
 * is an admin endpoint. But the key path never asked who the key belonged to.
 * A session is re-checked against the database every minute and dies when the
 * account is banned or deleted; a key was compared against its own hash and
 * nothing else.
 *
 * Measured against a production build: an admin's key was used to drive the
 * scheduler, then the owner was banned, demoted to member, and marked deleted.
 * The key answered 200 in all four states. An operator who removes an admin
 * has every reason to believe that ended their access, and it did not - the
 * key is a bearer credential the person may still be holding, and it is not
 * shown anywhere after creation, so there is nothing on screen to remind
 * anybody it exists.
 *
 * A hard delete does take the keys with it: the row cascades. It is the three
 * reversible states that carry on, and those are the ones an operator reaches
 * for first.
 *
 * So the key is only as good as its owner's standing right now. Being an admin
 * is part of that, because being an admin is what it took to create it.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ownerStillAuthorises } from "@/core/lib/api-key-auth";

const ADMIN = { isBanned: false, isDeleted: false, roleName: "admin" };

describe("an owner who still stands behind the key", () => {
    it("authorises it", () => {
        expect(ownerStillAuthorises(ADMIN)).toBe(true);
    });
});

describe("an owner who does not", () => {
    it("cannot authorise it while banned", () => {
        expect(ownerStillAuthorises({ ...ADMIN, isBanned: true })).toBe(false);
    });

    it("cannot authorise it once deleted", () => {
        // The soft delete, which does not cascade the way a hard one does.
        expect(ownerStillAuthorises({ ...ADMIN, isDeleted: true })).toBe(false);
    });

    it("cannot authorise it after being demoted", () => {
        // Creating a key takes an admin, so using one does too. A key that
        // outlives the role that issued it is a permission an operator
        // believes they revoked.
        expect(ownerStillAuthorises({ ...ADMIN, roleName: "member" })).toBe(false);
        expect(ownerStillAuthorises({ ...ADMIN, roleName: null })).toBe(false);
    });

    it("cannot authorise it when there is no owner at all", () => {
        expect(ownerStillAuthorises(null)).toBe(false);
    });
});

describe("the answer", () => {
    it("is false whenever any one thing is wrong, not only when all are", () => {
        const wrong = [
            { ...ADMIN, isBanned: true, isDeleted: true, roleName: "member" },
            { ...ADMIN, isBanned: true, roleName: "member" },
            { ...ADMIN, isDeleted: true, roleName: "member" },
        ];
        for (const owner of wrong) {
            expect(ownerStillAuthorises(owner), JSON.stringify(owner)).toBe(false);
        }
    });
});

describe("the path that checks a key", () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), "src/core/lib/api-key-auth.ts"),
        "utf8",
    );

    it("asks the question, rather than only being able to", () => {
        // A rule with no caller is the shape this defect had: the session
        // path had the check and the key path did not, and both looked fine
        // on their own.
        expect(source).toContain("ownerStillAuthorises(");
    });

    it("reads the owner in the same query as the key", () => {
        // A second lookup on a path that already does a bcrypt round, on
        // every request an integration makes.
        expect(source).toMatch(/include:\s*\{[\s\S]*?user:/);
    });
});
