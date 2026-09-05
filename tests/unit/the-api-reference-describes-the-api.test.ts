import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Everything the API Reference lists has to be something you can call.
 *
 * `/admin/api-docs` renders a generated OpenAPI document, and it is the only
 * description of this platform's HTTP surface anyone gets. Both halves of it
 * were wrong in the same direction: they described operations rather than
 * reading them.
 *
 * The core half was a hand-written list of twenty-nine operations against a
 * real surface of a hundred and thirty-two. Two of the twenty-nine did not
 * exist. `POST /api/v1/auth/login` is the first call anyone integrating
 * writes, and there has never been a file exporting it - sign-in goes through
 * Auth.js at `/api/auth/[...nextauth]`. `DELETE /api/v1/users/{id}` promised
 * an account-deletion endpoint; `src/app/api/v1/users/[id]/route.ts` exports
 * GET and PATCH and nothing else.
 *
 * The module half guessed. A manifest's `method` is optional and sixty of the
 * sixty-three installed entries omit it, and the generator published each of
 * those as GET and POST. Measured before the fix, thirty-nine of sixty-three
 * were wrong: `/api/v1/announcements/{id}` was documented as GET and POST and
 * exports DELETE and PATCH, so both documented verbs 405 and both real ones
 * were missing. Every DELETE and PATCH in the installed module surface was
 * absent from the reference.
 *
 * Both halves are discovered from the exported verbs now. Prose is still
 * hand-written, and a prose entry naming an operation no route exports fails
 * the build rather than shipping.
 */

const ROOT = process.cwd();
const SPEC = JSON.parse(
    fs.readFileSync(path.join(ROOT, "src/core/generated/openapi.json"), "utf8"),
) as { paths: Record<string, Record<string, { summary: string; tags: string[]; security?: unknown[] }>> };

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/** The same reader the generator uses, restated so the test is independent. */
function exportedMethods(source: string): HttpMethod[] {
    const found = new Set<string>();
    for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
        found.add(m[1].toLowerCase());
    }
    for (const m of source.matchAll(/export\s+const\s*\{([^}]*)\}/g)) {
        for (const name of m[1].split(",")) found.add(name.split(":")[0].trim().toLowerCase());
    }
    return HTTP_METHODS.filter((m) => found.has(m));
}

const toOpenApi = (url: string) =>
    url.replace(/\[\.\.\.(.+?)\]/g, "{$1}").replace(/\[(.+?)\]/g, "{$1}");

/** Every operation core's route files export, minus the module dispatcher. */
function coreOperations(): { key: string; file: string }[] {
    const out: { key: string; file: string }[] = [];
    const walk = (dir: string, url: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full, `${url}/${entry.name}`);
                continue;
            }
            if (entry.name !== "route.ts") continue;
            const openApiPath = toOpenApi(url);
            if (openApiPath === "/api/v1/{path}") continue;
            for (const method of exportedMethods(fs.readFileSync(full, "utf8"))) {
                out.push({ key: `${method} ${openApiPath}`, file: path.relative(ROOT, full) });
            }
        }
    };
    walk(path.join(ROOT, "src/app/api"), "/api");
    return out;
}

/** Every operation an installed module's declared handler exports. */
function moduleOperations(): { key: string; module: string; handler: string }[] {
    const dir = path.join(ROOT, "src/modules");
    if (!fs.existsSync(dir)) return [];
    const out: { key: string; module: string; handler: string }[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(dir, entry.name, "module.json");
        if (!fs.existsSync(file)) continue;
        const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as {
            id: string;
            api?: { path: string; handler: string; method?: string }[];
        };
        for (const api of manifest.api ?? []) {
            const handler = path.join(dir, entry.name, api.handler.replace(/^\.?\//, ""));
            if (!fs.existsSync(handler)) continue;
            const methods = exportedMethods(fs.readFileSync(handler, "utf8"));
            for (const method of methods) {
                out.push({
                    key: `${method} ${toOpenApi(`/api/v1${api.path}`)}`,
                    module: manifest.id,
                    handler: api.handler,
                });
            }
        }
    }
    return out;
}

const published = new Set(
    Object.entries(SPEC.paths).flatMap(([url, item]) => Object.keys(item).map((m) => `${m} ${url}`)),
);

describe("the generated spec", () => {
    it("has something in it", () => {
        expect(Object.keys(SPEC.paths).length).toBeGreaterThan(100);
        expect(published.size).toBeGreaterThan(200);
    });

    it("publishes no operation core does not export", () => {
        const core = new Set(coreOperations().map((o) => o.key));
        const modules = new Set(moduleOperations().map((o) => o.key));
        const invented = [...published].filter((k) => {
            const url = k.split(" ")[1];
            if (!url.startsWith("/api/auth") && !url.startsWith("/api/v1/") && !url.startsWith("/api/health")) return false;
            return !core.has(k) && !modules.has(k);
        });
        expect(invented).toEqual([]);
    });

    it("names the two operations that were invented", () => {
        // The exact pair the reference used to promise.
        expect(published.has("post /api/v1/auth/login")).toBe(false);
        expect(published.has("delete /api/v1/users/{id}")).toBe(false);
    });

    it("publishes every operation core does export", () => {
        const missing = coreOperations()
            .filter((o) => !published.has(o.key))
            .map((o) => `${o.key} (${o.file})`);
        expect(missing).toEqual([]);
    });

    it("publishes every operation an installed module exports", () => {
        const ops = moduleOperations();
        expect(ops.length).toBeGreaterThan(50);
        const missing = ops.filter((o) => !published.has(o.key)).map((o) => `${o.module}: ${o.key}`);
        expect(missing).toEqual([]);
    });

    it("carries the verbs that used to be dropped on the floor", () => {
        // Every DELETE and PATCH a module exports was absent before.
        expect(published.has("delete /api/v1/announcements/{id}")).toBe(true);
        expect(published.has("patch /api/v1/announcements/{id}")).toBe(true);
        expect(published.has("post /api/v1/announcements/{id}")).toBe(false);
        expect(published.has("delete /api/v1/store/cart")).toBe(true);
    });

    it("leaves the module dispatcher out, so one path does not stand for two hundred", () => {
        expect(SPEC.paths["/api/v1/{path}"]).toBeUndefined();
    });

    it("points at where sign-in actually happens", () => {
        expect(published.has("post /api/auth/{nextauth}")).toBe(true);
        expect(SPEC.paths["/api/auth/{nextauth}"].post.summary).toMatch(/Auth\.js/);
    });

    it("gives every operation a summary and a tag", () => {
        const bare: string[] = [];
        for (const [url, item] of Object.entries(SPEC.paths)) {
            for (const [method, op] of Object.entries(item)) {
                if (!op.summary?.trim() || !op.tags?.length) bare.push(`${method} ${url}`);
            }
        }
        expect(bare).toEqual([]);
    });

    it("declares a path parameter for every placeholder in the URL", () => {
        const undeclared: string[] = [];
        for (const [url, item] of Object.entries(SPEC.paths)) {
            const names = [...url.matchAll(/\{(.+?)\}/g)].map((m) => m[1]);
            if (names.length === 0) continue;
            for (const [method, op] of Object.entries(item)) {
                const declared = ((op as { parameters?: { name: string; in: string }[] }).parameters ?? [])
                    .filter((p) => p.in === "path")
                    .map((p) => p.name);
                for (const name of names) {
                    if (!declared.includes(name)) undeclared.push(`${method} ${url}: ${name}`);
                }
            }
        }
        expect(undeclared).toEqual([]);
    });

    it("marks the admin surface as needing credentials", () => {
        const open = Object.entries(SPEC.paths)
            .filter(([url]) => url.startsWith("/api/v1/admin/"))
            .flatMap(([url, item]) =>
                Object.entries(item)
                    .filter(([, op]) => !op.security)
                    .map(([method]) => `${method} ${url}`),
            );
        expect(open).toEqual([]);
    });
});

describe("the generator", () => {
    const source = fs.readFileSync(path.join(ROOT, "scripts/generate-openapi.ts"), "utf8");

    it("reads the verbs instead of assuming two", () => {
        expect(source).toContain("function exportedMethods");
        expect(source).not.toMatch(/return \["get", "post"\]/);
    });

    it("fails the build on a documented operation nothing exports", () => {
        const guard = source.slice(source.indexOf("function buildPathsFromCore"));
        expect(guard).toContain("that no route exports");
        expect(guard).toContain("process.exit(1)");
    });

    it("keeps the spec regenerated rather than edited by hand", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
            scripts: Record<string, string>;
        };
        expect(Object.values(pkg.scripts).join(" ")).toContain("generate-openapi");
    });
});
