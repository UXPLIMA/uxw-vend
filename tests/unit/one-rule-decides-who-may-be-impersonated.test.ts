import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { impersonationRefusal } from "@/core/lib/impersonation";

/**
 * Two places decided who may be impersonated, and they disagreed.
 *
 * `POST /api/v1/admin/impersonate/start` refuses a non-admin caller, a
 * session already impersonating, the caller themselves, a missing user, a
 * banned user and another admin. It then returns, and the client calls
 * `update({ impersonate: userId })`, which is what actually rewrites the
 * token in the `jwt` callback.
 *
 * That callback re-checked three of the six: admin caller, no stacking,
 * target exists. It did not check `isBanned` and it did not check that the
 * target is another admin. The route is where the rules were written and the
 * callback is where they are enforced, so an admin who called `update()`
 * without going through the route got what the route says it forbids:
 * impersonating another administrator, whose actions the audit log would then
 * attribute to them.
 *
 * The actor is an admin either way, so this is not a way in. It is a control
 * the product states and did not hold, and attribution is what it protects.
 *
 * One rule now, in one place, called by both.
 */

const ROOT = process.cwd();
const admin = { id: "a1", role: "admin", originalUserId: undefined as string | undefined };
const member = { id: "u1", isBanned: false, role: { name: "member" } };

describe("who may be impersonated", () => {
    it("lets an admin step into an ordinary account", () => {
        expect(impersonationRefusal(admin, member)).toBeNull();
    });

    it("refuses a caller who is not an admin", () => {
        expect(impersonationRefusal({ ...admin, role: "member" }, member)).toBe("not_admin");
    });

    it("refuses a session that is already somebody else", () => {
        expect(impersonationRefusal({ ...admin, originalUserId: "a0" }, member)).toBe("already");
    });

    it("refuses the caller's own account", () => {
        expect(impersonationRefusal(admin, { ...member, id: "a1" })).toBe("self");
    });

    it("refuses an account that is not there", () => {
        expect(impersonationRefusal(admin, null)).toBe("not_found");
    });

    it("refuses a banned account", () => {
        expect(impersonationRefusal(admin, { ...member, isBanned: true })).toBe("banned");
    });

    it("refuses another administrator", () => {
        expect(impersonationRefusal(admin, { ...member, role: { name: "admin" } })).toBe("admin_target");
    });
});

describe("the two places that decide", () => {
    it("both ask the one rule", () => {
        const route = fs.readFileSync(
            path.join(ROOT, "src/app/api/v1/admin/impersonate/start/route.ts"),
            "utf8",
        );
        const auth = fs.readFileSync(path.join(ROOT, "src/core/lib/auth.ts"), "utf8");
        expect(route, "the route should not carry its own copy").toContain("impersonationRefusal");
        expect(auth, "the callback is where the token is written").toContain("impersonationRefusal");
    });

    it("leaves no second copy of the target checks in the callback", () => {
        const auth = fs.readFileSync(path.join(ROOT, "src/core/lib/auth.ts"), "utf8");
        const start = auth.indexOf("Impersonation: start");
        const end = auth.indexOf("Impersonation: stop");
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const branch = auth.slice(start, end);
        // A hand-rolled check beside the shared one is how the two drifted.
        expect(branch).not.toMatch(/isBanned/);
    });
});
