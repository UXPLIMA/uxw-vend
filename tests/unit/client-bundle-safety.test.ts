/**
 * Server-only code reaching a browser bundle.
 *
 * A `"use client"` file and everything it imports is compiled for the
 * browser - including the far side of a dynamic `import()`, which the
 * bundler still has to resolve even though it loads it lazily. If any of
 * that reaches `next/headers`, `fs` or `@prisma/client`, the production
 * build fails outright with "Module not found" or "This API is only
 * available in Server Components".
 *
 * That is exactly what happened when the auth challenge landed: the three
 * auth forms imported one constant from `auth-challenge.ts`, whose other
 * export dynamically imports the hook bus, which reaches the database, the
 * logger and the storage layer. Three build errors, seven import traces,
 * and nothing at all in `npm run typecheck`, `lint` or `test` to say so -
 * the failure only showed up three minutes into `npm run build`.
 *
 * So this gate builds the same graph the bundler does and fails on the same
 * edge, in a second. The client-safe names now live in
 * `auth-challenge-shared.ts`; `auth-challenge.ts` is the server half.
 *
 * Barrels are modelled the way a bundler treats them: a file whose entire
 * body is `export { … } from "…"` re-exports gets followed only along the
 * names actually asked for. That is what keeps `@/core/sdk` importable from
 * a client component - `formatDate` pulls in `utils.ts` and nothing else,
 * even though the same barrel also re-exports the hook bus.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve as resolvePath, relative } from "path";

const ROOT = join(__dirname, "../..");
const SCANNED = ["src", "module-sources"];

/**
 * Specifiers that cannot exist in a browser bundle. Node builtins that Next
 * polyfills (`path`, `buffer`, `util`) are deliberately absent - they build
 * fine and saying otherwise would be a false alarm.
 */
const SERVER_ONLY = new Set([
    "server-only",
    "next/headers",
    "fs",
    "fs/promises",
    "node:fs",
    "node:fs/promises",
    "child_process",
    "node:child_process",
    "async_hooks",
    "node:async_hooks",
    "net",
    "node:net",
    "dns",
    "node:dns",
    "@prisma/client",
    "nodemailer",
    "bcryptjs",
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) sourceFiles(full, out);
        else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
    }
    return out;
}

const ALL = SCANNED.flatMap((d) => sourceFiles(join(ROOT, d)));
const rel = (f: string) => relative(ROOT, f);
const read = (f: string) => readFileSync(f, "utf-8");

/** Resolve an import specifier the way the tsconfig path alias does. */
function resolveSpec(spec: string, fromFile: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
    else if (spec.startsWith(".")) base = resolvePath(dirname(fromFile), spec);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
        if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
}

interface Parsed {
    /** Specifiers pulled in whenever any part of this module is used. */
    edges: string[];
    /** Exported name -> the specifier it is re-exported from. */
    reexports: Map<string, string>;
    starReexport: boolean;
    /** False for a pure re-export barrel, which a bundler shakes per name. */
    hasOwnCode: boolean;
}

const parsed = new Map<string, Parsed>();
function parse(file: string): Parsed {
    const cached = parsed.get(file);
    if (cached) return cached;
    const src = read(file);
    const edges: string[] = [];
    const reexports = new Map<string, string>();
    let starReexport = false;
    let body = src;

    // Value imports only - `import type` is erased before bundling.
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g)) edges.push(m[1]);
    for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) edges.push(m[1]);
    for (const m of src.matchAll(/(?:^|\n)\s*export\s+(type\s+)?\{([^}]*)\}\s*from\s+["']([^"']+)["']/g)) {
        body = body.replace(m[0], "");
        if (m[1]) continue;
        for (const part of m[2].split(",")) {
            const name = part.trim().split(/\s+as\s+/).pop()?.trim();
            if (name) reexports.set(name, m[3]);
        }
    }
    for (const m of src.matchAll(/(?:^|\n)\s*export\s+\*\s*from\s+["']([^"']+)["']/g)) {
        starReexport = true;
        edges.push(m[1]);
    }

    const stripped = body
        .replace(/(?:^|\n)\s*import\s[^;]*;?/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(?:^|\n)\s*\/\/[^\n]*/g, "")
        .replace(/;/g, ""); // semicolons left behind by a removed re-export
    const out = { edges, reexports, starReexport, hasOwnCode: /\S/.test(stripped) };
    parsed.set(file, out);
    return out;
}

type Wanted = Set<string> | "*";

/** Which names a file asks for from one specifier. */
function importedNames(src: string, spec: string): Wanted {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = new Set<string>();
    for (const m of src.matchAll(new RegExp(`import\\s+([^"';]*?)\\sfrom\\s+["']${escaped}["']`, "g"))) {
        const clause = m[1];
        // A default or namespace import can reach anything the module exports.
        if (/^\s*\*/.test(clause) || !clause.includes("{")) return "*";
        for (const part of clause.slice(clause.indexOf("{") + 1, clause.lastIndexOf("}")).split(",")) {
            const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
            if (n) names.add(n);
        }
    }
    return names.size ? names : "*";
}

/** Walk the browser graph from one entry, collecting server-only edges. */
function serverOnlyReach(entry: string): { module: string; spec: string; chain: string[] }[] {
    const found: { module: string; spec: string; chain: string[] }[] = [];
    const seen = new Set<string>();
    const queue: [string, Wanted, string[]][] = [[entry, "*", [rel(entry)]]];
    while (queue.length) {
        const [cur, want, chain] = queue.shift()!;
        const key = `${cur}|${want === "*" ? "*" : [...want].sort().join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const info = parse(cur);
        const src = read(cur);
        const specs = new Set<string>();
        // Anything with a body of its own is bundled whole; only a pure
        // re-export barrel can be narrowed to the names asked for.
        if (want === "*" || info.hasOwnCode || info.starReexport) for (const e of info.edges) specs.add(e);
        for (const name of want === "*" ? info.reexports.keys() : want) {
            const s = info.reexports.get(name);
            if (s) specs.add(s);
            else if (want !== "*" && !info.hasOwnCode) for (const e of info.edges) specs.add(e);
        }
        for (const spec of specs) {
            if (SERVER_ONLY.has(spec)) {
                found.push({ module: rel(cur), spec, chain });
                continue;
            }
            const next = resolveSpec(spec, cur);
            if (next) queue.push([next, importedNames(src, spec), [...chain, rel(next)]]);
        }
    }
    return found;
}

const isClientEntry = (src: string) =>
    /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src);

const CLIENT_ENTRIES = ALL.filter((f) => isClientEntry(read(f)));

describe("client bundle safety", () => {
    it("finds the client components to check", () => {
        expect(CLIENT_ENTRIES.length).toBeGreaterThan(100);
    });

    it("no client component reaches server-only code", () => {
        const offenders: string[] = [];
        for (const entry of CLIENT_ENTRIES) {
            for (const hit of serverOnlyReach(entry)) {
                offenders.push(`${hit.module} imports "${hit.spec}"\n    ${hit.chain.join("\n -> ")}`);
            }
        }
        expect(
            offenders,
            `These import chains put server-only code in a browser bundle and fail "npm run build":\n\n${offenders.join("\n\n")}`,
        ).toEqual([]);
    });

    it("keeps the auth challenge split honest", () => {
        // The shared half is what the three auth forms import; the server
        // half is what reaches the hook bus. If they ever merge again the
        // build breaks, so assert both sides of the line directly.
        const shared = join(ROOT, "src/core/lib/auth-challenge-shared.ts");
        const server = join(ROOT, "src/core/lib/auth-challenge.ts");
        expect(serverOnlyReach(shared)).toEqual([]);
        expect(serverOnlyReach(server).length).toBeGreaterThan(0);
    });

    it("keeps @/core/sdk a pure re-export barrel", () => {
        // Eleven module client components import this barrel. It stays
        // importable from the browser only while a bundler can drop the
        // re-exports they do not name - which stops being true the moment
        // the file grows a declaration of its own.
        const info = parse(join(ROOT, "src/core/sdk/index.ts"));
        expect(info.hasOwnCode, "src/core/sdk/index.ts must contain only `export { … } from` re-exports").toBe(false);
        expect(info.reexports.size).toBeGreaterThan(5);
    });
});
