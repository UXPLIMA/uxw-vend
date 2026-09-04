import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * An endpoint that answers "was this guess right?" needs a ceiling.
 *
 * `bcrypt.compare` and `verifyToken` are exactly that question. Five handlers
 * asked it with no limit: the profile route's password-change branch (an
 * online password oracle, and a bcrypt round at cost 12 of CPU per request),
 * and the two-factor module's disable, verify and regenerate-codes routes. The
 * store's gift-code redeem is the same shape without a hash - a bearer secret
 * looked up by exact match, with the reply saying whether the guess exists.
 *
 * The ceiling must be role-independent. `rateLimitForRole` scales its budget
 * by the caller's role and treats a multiplier of 0 as unlimited, which is
 * right for throughput and wrong for brute force.
 */
const COMPARES_SECRET = /bcrypt\.compare\(|verifyToken\(/;
const HAS_STRICT_LIMIT = /rateLimit(?:Strict)?\(/;

function routeFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (entry.name === "route.ts") {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

describe("secret checks are rate limited", () => {
    it("no handler compares a secret without a ceiling", () => {
        const offenders: string[] = [];
        for (const dir of ["src/app/api", "module-sources"]) {
            for (const file of routeFiles(path.join(ROOT, dir))) {
                const content = fs.readFileSync(file, "utf8");
                if (!COMPARES_SECRET.test(content)) continue;
                if (HAS_STRICT_LIMIT.test(content)) continue;
                offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });

    it("a module reaches the limiter through the SDK, and gets the strict one", () => {
        const sdk = fs.readFileSync(path.join(ROOT, "src/core/sdk/server.ts"), "utf8");
        expect(sdk).toContain("rateLimit as rateLimitStrict");
        for (const file of routeFiles(path.join(ROOT, "module-sources"))) {
            const content = fs.readFileSync(file, "utf8");
            if (!COMPARES_SECRET.test(content)) continue;
            expect(content, `${path.relative(ROOT, file)} must use rateLimitStrict`)
                .toContain("rateLimitStrict(");
        }
    });

    it("redeeming a gift code has a ceiling", () => {
        const redeem = fs.readFileSync(
            path.join(ROOT, "module-sources/store/api/gift-codes/redeem/route.ts"),
            "utf8",
        );
        expect(redeem).toContain("rateLimitStrict(");
    });

    it("a gift code is not walkable", () => {
        const issuer = fs.readFileSync(
            path.join(ROOT, "module-sources/store/api/gift-codes/route.ts"),
            "utf8",
        );
        const match = /randomBytes\((\d+)\)/.exec(issuer);
        expect(match, "gift codes must come from randomBytes").not.toBeNull();
        expect(Number(match![1])).toBeGreaterThanOrEqual(8);
    });

    it("the password-change branch has its own ceiling, like account deletion", () => {
        const profile = fs.readFileSync(path.join(ROOT, "src/app/api/v1/auth/profile/route.ts"), "utf8");
        expect(profile).toContain("profile-password:");
    });
});
