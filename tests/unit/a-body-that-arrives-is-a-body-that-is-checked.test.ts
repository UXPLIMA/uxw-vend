import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A request body is read and then checked, not read and then believed.
 *
 * `readJsonBody` answers 400 for a body that is not JSON and refuses one that
 * is too large, and every endpoint that takes a body uses it. What it cannot
 * do is say whether the JSON means anything: that is the schema's job, and
 * two routes had none. Both were payment callbacks, and both cast the body to
 * a TypeScript interface, which the compiler believes and the runtime does
 * not. One turned an amount it could not read into `NaN` and settled an order
 * with it; the other rounded it to zero and settled the order anyway.
 *
 * The signature on those payloads is checked first, so this is not about a
 * stranger's input. It is about a provider sending a shape this build cannot
 * read, and about that being answered rather than averaged away.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const VALIDATES = /\.safeParse\s*\(|\bz\.object\s*\(|Schema\.parse\s*\(/;

function routeFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) routeFiles(full, out);
        else if (entry.name === "route.ts") out.push(full);
    }
    return out;
}

describe("an endpoint that takes a body", () => {
    it("checks what the body says before acting on it", () => {
        const unchecked: string[] = [];
        let reading = 0;
        for (const base of ["src/app", "module-sources"]) {
            for (const file of routeFiles(path.join(ROOT, base))) {
                const source = fs.readFileSync(file, "utf8");
                if (!source.includes("readJsonBody")) continue;
                reading++;
                if (!VALIDATES.test(source)) unchecked.push(path.relative(ROOT, file));
            }
        }
        expect(reading, "endpoints should still be reading bodies through the helper").toBeGreaterThan(100);
        expect(
            unchecked,
            `these read a body and act on it without a schema:\n${unchecked.join("\n")}`,
        ).toEqual([]);
    });
});
