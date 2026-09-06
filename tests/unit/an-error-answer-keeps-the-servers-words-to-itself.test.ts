import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * What failed is the caller's business. Where it failed is not.
 *
 * An error thrown inside a route carries the server's own words: Prisma names
 * the file and line of the call it could not make, `fetch` names the host it
 * could not reach, `fs` names the absolute path it could not read. Handing
 * that back is a map of the install, and it is drawn for whoever asked, which
 * on an admin route means whoever is holding an admin session.
 *
 * `devOnlyDetail` exists for the case where the detail is worth having: it
 * returns the message outside production and nothing inside it. Four routes
 * skipped it and answered with `err.message` directly.
 *
 * The rule this pins: inside a catch, nothing derived from the error's own
 * message reaches a response body. A route that wants to act on a known
 * failure compares the message and then answers with its own words, so the
 * literal a reader sees is visible at the point it is sent.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src/app", "module-sources"];

const RESPONDERS = ["NextResponse.json(", "apiError(", "apiSuccess(", "apiPaginated("];

function routeFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) routeFiles(full, out);
        else if (entry.name === "route.ts") out.push(full);
    }
    return out;
}

/** Text between the brace at `open` and the one that closes it. */
function block(source: string, open: number): string {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}" && --depth === 0) return source.slice(open, i + 1);
    }
    return source.slice(open);
}

/** Text between the parenthesis at `open` and the one that closes it. */
function call(source: string, open: number): string {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")" && --depth === 0) return source.slice(open, i + 1);
    }
    return source.slice(open);
}

function leaks(): string[] {
    const found: string[] = [];
    for (const base of SCANNED) {
        for (const file of routeFiles(path.join(ROOT, base))) {
            const source = fs.readFileSync(file, "utf8");
            for (const start of [...source.matchAll(/catch\s*\([^)]*\)\s*\{/g)]) {
                const body = block(source, start.index + start[0].length - 1);

                // Names holding the error's message, however it was read out.
                const tainted = new Set<string>();
                for (const m of body.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*[^;]*?\.message\b/g)) {
                    tainted.add(m[1]);
                }

                for (const responder of RESPONDERS) {
                    let at = body.indexOf(responder);
                    while (at !== -1) {
                        const args = call(body, at + responder.length - 1);
                        const bare = [...tainted].filter((name) =>
                            new RegExp(`(?<![.\\w])${name}\\b(?!\\s*[.=]|\\s*===)`).test(args),
                        );
                        if (/\.message\b/.test(args) || bare.length > 0) {
                            const line = source.slice(0, start.index).split("\n").length;
                            found.push(`${path.relative(ROOT, file)}: the catch at line ${line}`);
                        }
                        at = body.indexOf(responder, at + 1);
                    }
                }
            }
        }
    }
    return [...new Set(found)];
}

describe("an answer built from a failure", () => {
    it("does not repeat what the server said to itself", () => {
        const talking = leaks();
        expect(
            talking,
            `these answer with the error's own message. Say what failed in the route's own words, and put the detail behind devOnlyDetail() if it is worth having:\n${talking.join("\n")}`,
        ).toEqual([]);
    });

    it("is looked for in the routes that catch anything", () => {
        // Guards the scanner: a pattern that stopped matching would make the
        // test above pass by never looking at a catch block at all.
        const catches = SCANNED.flatMap((b) => routeFiles(path.join(ROOT, b)))
            .map((f) => [...fs.readFileSync(f, "utf8").matchAll(/catch\s*\([^)]*\)\s*\{/g)].length)
            .reduce((a, b) => a + b, 0);
        expect(catches).toBeGreaterThan(50);
    });
});
