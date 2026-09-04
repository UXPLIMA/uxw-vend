import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * 401 and 403 answer different questions: "I do not know who you are" and
 * "I know, and you may not". 208 guards across the API separate them. Thirty
 * six folded both into one condition and answered 403, so an anonymous caller
 * was told it was forbidden rather than that it needed to sign in.
 *
 * It matters beyond tidiness. A client that renews an expired session keys on
 * 401 - the store, forum and suggestions pages each do exactly that - and an
 * admin whose session lapsed on one of these endpoints got "Forbidden" back,
 * which reads as a permission problem and sends them to ask for access they
 * already have. Anything generated from these routes, the OpenAPI document
 * included, inherited the wrong code too.
 *
 * This pins the majority convention: check the session, answer 401, then
 * check the permission and answer 403.
 */

const ROOT = path.resolve(__dirname, "../..");

function routeFiles(): string[] {
    const out: string[] = [];
    for (const base of ["src/app", "module-sources"]) {
        const walk = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name === "route.ts") out.push(full);
            }
        };
        walk(path.join(ROOT, base));
    }
    return out;
}

const FILES = routeFiles();

/** A guard is "collapsed" when the session test shares an `if` with something
 *  else and the branch answers 403. */
function collapsedGuards(body: string): number[] {
    const lines = body.split("\n");
    const hits: number[] = [];
    lines.forEach((line, i) => {
        if (!line.includes("!session?.user?.id")) return;
        if (!line.includes("||")) return;
        const window = lines.slice(i, i + 4).join("\n");
        if (/status:\s*403/.test(window)) hits.push(i + 1);
    });
    return hits;
}

describe("API auth guards", () => {
    it("finds the route handlers", () => {
        expect(FILES.length).toBeGreaterThan(150);
    });

    it("answer 401 when there is no session, not 403", () => {
        const offenders: string[] = [];
        for (const file of FILES) {
            const hits = collapsedGuards(fs.readFileSync(file, "utf8"));
            for (const line of hits) {
                offenders.push(`${path.relative(ROOT, file)}:${line}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("still answer 403 once a caller is known but not allowed", () => {
        // The split has to keep the second half: a route that dropped its
        // permission check would pass the test above by being wide open.
        const body = fs.readFileSync(
            path.join(ROOT, "src/app/api/v1/broadcasts/route.ts"),
            "utf8",
        );
        expect(body).toMatch(/if \(!session\?\.user\?\.id\) \{[\s\S]*?status: 401/);
        expect(body).toMatch(/if \(!\(await isAdmin\([\s\S]*?status: 403/);
    });

    it("keeps the split form the overwhelming majority", () => {
        let split = 0;
        for (const file of FILES) {
            const lines = fs.readFileSync(file, "utf8").split("\n");
            lines.forEach((line, i) => {
                if (!line.includes("!session?.user?.id") || line.includes("||")) return;
                if (/status:\s*401/.test(lines.slice(i, i + 4).join("\n"))) split += 1;
            });
        }
        expect(split).toBeGreaterThan(200);
    });
});
