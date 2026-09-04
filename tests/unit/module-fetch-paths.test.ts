import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCES = path.join(ROOT, "module-sources");

/**
 * Mirrors `validate-module`'s "Fetched API paths exist" rule under `npm test`.
 *
 * A module's own screens reach its endpoints through the dispatcher, which
 * answers only the paths the manifest declares. The blog's comment section
 * fetched `/api/v1/blog/${id}/comments`, a path that was never declared: the
 * dispatcher returned 404, the component's `.then` swallowed it, and every
 * article rendered an empty comment list while posting a comment silently did
 * nothing. Nothing in the build said so, because nothing checked.
 */
const normalize = (raw: string) =>
    raw.replace(/\$\{[^}]*\}/g, "[p]").replace(/\[[^\]]+\]/g, "[p]").split("?")[0].replace(/\/+$/, "");

/** Core's endpoints, read off the filesystem: a module may call these too. */
function coreApiPaths(): Set<string> {
    const found = new Set<string>();
    const walk = (dir: string, prefix: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
            else if (entry.name === "route.ts") found.add(normalize(`/api${prefix}`));
        }
    };
    walk(path.join(ROOT, "src/app/api"), "");
    return found;
}

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (/\.tsx?$/.test(entry.name) && entry.name !== "route.ts") {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

/** The literal a `fetch(` opens, `${...}` kept whole so a nested quote cannot end it early. */
function readLiteral(source: string, start: number): string | null {
    const quote = source[start];
    if (quote !== '"' && quote !== "'" && quote !== "`") return null;
    let out = "";
    for (let i = start + 1; i < source.length; i++) {
        const c = source[i];
        if (c === "\\") { out += c + (source[i + 1] ?? ""); i++; continue; }
        if (quote === "`" && c === "$" && source[i + 1] === "{") {
            let depth = 1;
            let expr = "${";
            i += 2;
            for (; i < source.length && depth > 0; i++) {
                if (source[i] === "{") depth++;
                else if (source[i] === "}") depth--;
                if (depth > 0) expr += source[i];
            }
            out += `${expr}}`;
            i--;
            continue;
        }
        if (c === quote) return out;
        if (c === "\n" && quote !== "`") return null;
        out += c;
    }
    return null;
}

describe("module fetch paths", () => {
    it("no module fetches a path under its own namespace that nothing routes", () => {
        const core = coreApiPaths();
        const offenders: string[] = [];

        for (const entry of fs.readdirSync(SOURCES, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const modulePath = path.join(SOURCES, entry.name);
            const manifest = JSON.parse(
                fs.readFileSync(path.join(modulePath, "module.json"), "utf8"),
            ) as { api?: { path: string }[] };
            const api = manifest.api ?? [];
            if (api.length === 0) continue;

            const declared = new Set(api.map((a) => normalize(`/api/v1${a.path}`)));
            const owned = new Set(api.map((a) => a.path.split("/")[1]).filter(Boolean));

            for (const file of sourceFiles(modulePath)) {
                const source = fs.readFileSync(file, "utf8");
                for (const match of source.matchAll(/fetch\(\s*/g)) {
                    const raw = readLiteral(source, (match.index ?? 0) + match[0].length);
                    if (!raw || !raw.includes("/api/v1/")) continue;
                    const written = raw.slice(raw.indexOf("/api/v1"));
                    const namespace = written.slice("/api/v1/".length).split("/")[0].split("?")[0];
                    if (!owned.has(namespace)) continue;
                    if (declared.has(normalize(written)) || core.has(normalize(written))) continue;
                    // An interpolation glued to the end is usually a query string.
                    const literalPrefix = written.split("${")[0].replace(/\/+$/, "");
                    if (declared.has(literalPrefix) || core.has(literalPrefix)) continue;
                    const line = source.slice(0, match.index).split("\n").length;
                    offenders.push(`${path.relative(ROOT, file)}:${line} -> ${raw}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it("the blog comment section fetches the route the manifest declares", () => {
        const component = fs.readFileSync(
            path.join(SOURCES, "blog/components/CommentSection.tsx"),
            "utf8",
        );
        const manifest = JSON.parse(
            fs.readFileSync(path.join(SOURCES, "blog/module.json"), "utf8"),
        ) as { api: { path: string }[] };

        expect(manifest.api.map((a) => a.path)).toContain("/blog/comments");
        expect(component).toContain("/api/v1/blog/comments?articleId=");
        // The POST needs the article id in the body: the path no longer carries it.
        expect(component).toContain("articleId: id");
    });
});
