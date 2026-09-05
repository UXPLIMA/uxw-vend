import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A Server Component cannot hand a function to a Client Component.
 *
 * Everything a server component puts in a prop is serialised into the RSC
 * payload, and a closure has nothing to serialise. React refuses it at render
 * time, not at build time - so the page compiles, ships, and then throws on
 * every request. The admin users screen did exactly that: it paged through the
 * URL with `hrefFor={(n) => \`/admin/users?page=${n}\`}`, which took the whole
 * admin shell down with it and filled the console with the follow-on
 * `MISSING_MESSAGE: admin` from a tree re-rendering outside its provider.
 *
 * A prop that wants to be a function is a prop that wants to be data: the
 * pager now takes the name of the query parameter and builds its own links.
 *
 * The scan covers files with no `"use client"` at the top - server components,
 * where the mistake is possible - and looks for a prop whose value is a
 * function literal or a locally declared function.
 */

const ROOTS = ["src/app", "src/core/components", "module-sources"];

/** `prop={(a) => ...}`, `prop={async () => ...}`, `prop={function ...}`. */
const FUNCTION_LITERAL_PROP =
    /\n\s*([A-Za-z]\w*)=\{\s*(?:async\s*)?(?:\([\w\s,{}:[\]<>|?]*\)|[A-Za-z]\w*)\s*=>|\n\s*([A-Za-z]\w*)=\{\s*(?:async\s+)?function\b/g;

/** `prop={handler}` where `handler` is a function declared in the same file. */
const PROP_IDENTIFIER = /\n\s*([A-Za-z]\w*)=\{([A-Za-z]\w*)\}/g;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith(".tsx")) out.push(full);
    }
    return out;
}

function isClientComponent(source: string): boolean {
    const head = source.trimStart();
    return head.startsWith('"use client"') || head.startsWith("'use client'");
}

function localFunctionNames(source: string): Set<string> {
    const names = new Set<string>();
    for (const m of source.matchAll(/\bfunction\s+([A-Za-z]\w*)\s*\(/g)) names.add(m[1]);
    for (const m of source.matchAll(
        /\bconst\s+([A-Za-z]\w*)\s*(?::[^=]*)?=\s*(?:async\s*)?(?:\([\w\s,{}:[\]<>|?]*\)|[A-Za-z]\w*)\s*=>/g,
    )) {
        names.add(m[1]);
    }
    return names;
}

function lineOf(source: string, index: number): number {
    return source.slice(0, index).split("\n").length;
}

const serverComponents = ROOTS.flatMap((root) => walk(root))
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => !isClientComponent(source));

describe("a function does not cross the server boundary", () => {
    it("scans a real number of server components", () => {
        expect(serverComponents.length).toBeGreaterThan(20);
    });

    it("passes no function literal as a prop", () => {
        const offenders: string[] = [];
        for (const { file, source } of serverComponents) {
            for (const match of source.matchAll(FUNCTION_LITERAL_PROP)) {
                const prop = match[1] ?? match[2];
                offenders.push(`${file}:${lineOf(source, match.index ?? 0)} ${prop}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("passes no locally declared function as a prop", () => {
        const offenders: string[] = [];
        for (const { file, source } of serverComponents) {
            const functions = localFunctionNames(source);
            for (const match of source.matchAll(PROP_IDENTIFIER)) {
                // A component used as a prop - `icon={Trash2}` - is a
                // reference React renders, not a callback the client calls;
                // those are capitalised by convention.
                if (/^[A-Z]/.test(match[2])) continue;
                if (!functions.has(match[2])) continue;
                offenders.push(`${file}:${lineOf(source, match.index ?? 0)} ${match[1]}={${match[2]}}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("gives the pager a serialisable way to page through the URL", () => {
        const pager = readFileSync("src/core/components/ui/pagination.tsx", "utf8");
        expect(pager).toContain("pageParam");
        expect(pager).not.toContain("hrefFor: (page: number) => string");

        const users = readFileSync("src/app/[locale]/(admin)/admin/users/page.tsx", "utf8");
        expect(users).toContain('pageParam="page"');
    });
});
