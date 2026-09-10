/**
 * What a password change does to the sessions already signed in.
 *
 * Changing a password is what somebody does when they believe their account is
 * compromised. Under the JWT strategy the cookie is the session, so a cookie
 * an attacker already holds keeps working on its own terms - the new password
 * is not consulted again. Measured against a production build: sign in, reset
 * the password through the reset endpoint, wait out the sixty-second recheck,
 * and the old session still answered 200. The one action a victim knows to
 * take did nothing to the intruder.
 *
 * The revocation mechanism already existed for "sign out everywhere":
 * `UserSession.isRevoked`, read by the jwt callback on its next check. Nothing
 * connected it to a password change.
 *
 * Every other session ends and the one making the change survives, so a user
 * changing their password from their own account settings is not thrown out of
 * the page they are standing on. A reset has no session to spare - the person
 * doing it is not signed in - so it ends all of them.
 *
 * It takes effect on the next recheck rather than instantly, which is the same
 * bound a ban already has. A minute of a stolen cookie is a different thing
 * from an unbounded one.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sessionsToRevoke } from "@/core/lib/session-registry";

const ROOT = process.cwd();

describe("which sessions a password change ends", () => {
    it("ends every session when nothing is being spared", () => {
        expect(sessionsToRevoke("u1", null)).toEqual({
            userId: "u1",
            isRevoked: false,
        });
    });

    it("spares the one making the change, and only that one", () => {
        expect(sessionsToRevoke("u1", "token-abc")).toEqual({
            userId: "u1",
            isRevoked: false,
            tokenId: { not: "token-abc" },
        });
    });

    it("spares nothing when the caller's session cannot be named", () => {
        // A token that will not decode is not a session to trust with the
        // benefit of the doubt. Ending all of them costs one sign-in; sparing
        // an unknown one costs the whole point of the change.
        expect(sessionsToRevoke("u1", "")).toEqual({
            userId: "u1",
            isRevoked: false,
        });
    });

    it("never widens past the one user", () => {
        for (const spared of [null, "", "token-abc"]) {
            expect(sessionsToRevoke("u1", spared).userId).toBe("u1");
        }
    });
});

/**
 * The gate. A third way to write a password is a third place to forget this,
 * and the forgetting is silent: the change succeeds, the screen says so, and
 * the stolen cookie keeps working.
 */
describe("every path that writes a password", () => {
    // A *change*, not a create. Registration and the admin's "add a user"
    // both write the same line into `prisma.user.create`, and a brand new
    // account has no session anybody could be holding.
    const CHANGES_A_PASSWORD = /prisma\.user\.update\([\s\S]{0,400}?password:\s*hashedPassword/;

    function routeFiles(dir: string, out: string[] = []): string[] {
        if (!fs.existsSync(dir)) return out;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) routeFiles(full, out);
            else if (entry.name === "route.ts") out.push(full);
        }
        return out;
    }

    const writers = routeFiles(path.join(ROOT, "src/app/api")).filter((file) =>
        CHANGES_A_PASSWORD.test(fs.readFileSync(file, "utf8")),
    );

    it("is found by the scan", () => {
        // Two today: the reset and the profile's change branch. If this drops
        // to zero the gate below passes while checking nothing.
        expect(writers.length).toBeGreaterThanOrEqual(2);
    });

    it("ends the sessions that password was protecting", () => {
        const missing = writers
            .filter((file) => !fs.readFileSync(file, "utf8").includes("revokeSessionsFor"))
            .map((file) => path.relative(ROOT, file));
        expect(missing).toEqual([]);
    });
});
