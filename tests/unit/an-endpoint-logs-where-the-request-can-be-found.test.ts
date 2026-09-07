import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A failure inside a request is logged where that request can be found again.
 *
 * `log` is not a nicer `console`. It emits JSON lines in production and it
 * carries a correlation id, bound once in the proxy and propagated through
 * `AsyncLocalStorage`, so every line a request produces can be gathered back
 * into that request, however deep in a module hook it was written. It also
 * respects `LOG_LEVEL`.
 *
 * `console.error` has none of that. It writes one bare line with no id, no
 * level and no shape, and an operator reading the log of a failure has no way
 * to join it to the request that caused it. Forty two of those were spread
 * over twenty three endpoints.
 *
 * The rule is scoped to where a request exists. A client component has no
 * correlation id and cannot import the logger anyway, since it reaches
 * `next/headers` and `async_hooks`, so a `"use client"` file is left alone.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = ["src/app", "module-sources"];

/**
 * Any mention of the console, called or handed on. `.catch(console.error)`
 * loses the request the same way a direct call does, and it was the shape
 * six of these took.
 */
const CONSOLE = /\bconsole\.(log|error|warn|info|debug)\b/;

/** A line that only talks about the console is not one that writes to it. */
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

function routeFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) routeFiles(full, out);
        else if (entry.name === "route.ts") out.push(full);
    }
    return out;
}

describe("an endpoint", () => {
    it("writes its failures where the request can be found again", () => {
        const bare: string[] = [];
        for (const base of SCANNED) {
            for (const file of routeFiles(path.join(ROOT, base))) {
                const source = fs.readFileSync(file, "utf8");
                if (source.slice(0, 200).includes('"use client"')) continue;
                source.split("\n").forEach((line, i) => {
                    if (CONSOLE.test(line) && !COMMENT.test(line)) {
                        bare.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 80)}`);
                    }
                });
            }
        }
        expect(
            bare,
            `these write to the console, so an operator cannot join them to the request that caused them. Use log.error / log.warn:\n${bare.join("\n")}`,
        ).toEqual([]);
    });

    it("is looked for in the endpoints that exist", () => {
        const count = SCANNED.reduce((n, b) => n + routeFiles(path.join(ROOT, b)).length, 0);
        expect(count).toBeGreaterThan(100);
    });
});
