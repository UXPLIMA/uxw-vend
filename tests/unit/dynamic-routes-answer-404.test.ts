import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { matchModuleRoute } from "@/core/lib/route-matcher";

/**
 * A URL that names nothing has to say so in the status line.
 *
 * Seven public module pages looked their subject up in the browser, so by the
 * time they knew there was no such player, product, article, form, page or
 * topic they had already sent 200 and a rendered shell. That is a soft 404:
 * a crawler indexes it, a link checker walks past it, and a monitor watching
 * for a status sees a healthy page. `/player/nobody` and
 * `/store/product/99999` both answered 200 on the demo.
 *
 * Rewriting seven interactive pages as server components would have been a
 * large change for a small question, so the module answers the question
 * separately: a route may declare a `resolver`, a file default-exporting
 * `(params) => Promise<boolean>`, and core's catch-all asks it before
 * rendering and calls `notFound()` on false. A page that already resolves on
 * the server and calls `notFound()` itself - blog does - needs nothing.
 *
 * This gate holds the rule for every module, installed or not, and pins the
 * two halves of the wiring that make it work.
 */

const ROOT = path.resolve(__dirname, "../..");
const SOURCES = path.join(ROOT, "module-sources");

interface Route { path: string; component: string; resolver?: string; noindex?: boolean }
interface Manifest { id: string; routes?: Route[] }

function manifests(): Manifest[] {
    return fs.readdirSync(SOURCES, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(SOURCES, e.name, "module.json"))
        .filter((p) => fs.existsSync(p))
        .map((p) => JSON.parse(fs.readFileSync(p, "utf8")) as Manifest);
}

/** How a route answers a URL that names nothing. */
export function answers404(moduleDir: string, route: Route): "resolver" | "server" | "no" {
    if (route.resolver) return "resolver";
    const component = path.join(moduleDir, route.component);
    if (!fs.existsSync(component)) return "no";
    const body = fs.readFileSync(component, "utf8");
    if (/^\s*["']use client["']/m.test(body)) return "no";
    return /\bnotFound\s*\(\s*\)/.test(body) ? "server" : "no";
}

describe("dynamic public routes", () => {
    const all = manifests();
    const dynamic = all.flatMap((m) =>
        (m.routes ?? []).filter((r) => r.path.includes("[")).map((r) => ({ module: m.id, route: r })),
    );

    it("finds the routes to check", () => {
        expect(all.length).toBeGreaterThan(40);
        expect(dynamic.length).toBeGreaterThanOrEqual(9);
    });

    it("every one of them 404s on a URL that names nothing", () => {
        const soft = dynamic
            .filter(({ module, route }) => answers404(path.join(SOURCES, module), route) === "no")
            .map(({ module, route }) => `${module} ${route.path}`);
        expect(soft).toEqual([]);
    });

    it("every declared resolver file exists and default-exports the check", () => {
        const problems: string[] = [];
        for (const { module, route } of dynamic) {
            if (!route.resolver) continue;
            const file = path.join(SOURCES, module, route.resolver);
            if (!fs.existsSync(file)) { problems.push(`${module} ${route.resolver} missing`); continue; }
            const body = fs.readFileSync(file, "utf8");
            if (!/export default async function \w+\(/.test(body)) {
                problems.push(`${module} ${route.resolver} has no default export`);
            }
            if (!/Promise<boolean>/.test(body)) {
                problems.push(`${module} ${route.resolver} does not answer a boolean`);
            }
            // A resolver runs on every request for the route, so it reads one
            // column, not a whole row with its relations.
            if (!/select:\s*\{\s*id:\s*true\s*\}/.test(body)) {
                problems.push(`${module} ${route.resolver} selects more than it needs`);
            }
        }
        expect(problems).toEqual([]);
    });

    it("keeps one visitor's own pages out of the index", () => {
        // A cart, an order confirmation, a support ticket: pages whose content
        // belongs to one person have no business in a search result.
        const shouldBeNoindex = ["/store/cart", "/store/order-success", "/support", "/support/[id]"];
        const indexed = all
            .flatMap((m) => (m.routes ?? []).map((r) => r))
            .filter((r) => shouldBeNoindex.includes(r.path) && !r.noindex)
            .map((r) => r.path);
        expect(indexed).toEqual([]);
    });
});

describe("the wiring", () => {
    const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

    it("collects the resolvers into a generated map", () => {
        const gen = read("scripts/generate-registry.ts");
        expect(gen).toContain("if (route.resolver) routeResolvers.push(");
        expect(gen).toContain("ModuleRouteResolvers");
    });

    it("accepts resolver in the manifest and counts it as a file reference", () => {
        const schema = read("src/core/lib/module-manifest-schema.ts");
        expect(schema).toContain('resolver: relativePath("resolver").optional()');
        // install, upload and update all check refs through this one walk
        expect(schema).toContain("push(r.component); push(r.layout); push(r.resolver);");
    });

    it("asks the resolver before rendering, and before saying the page is indexable", () => {
        const catchAll = read("src/app/[locale]/[...slug]/page.tsx");
        expect(catchAll).toContain("const routeExists = cache(");
        // once in generateMetadata, once in the page: cache() keeps it to one query
        expect(catchAll.match(/await routeExists\(match\.key, match\.params\)/g)?.length).toBe(2);
        expect(catchAll).toContain("if (!(await routeExists(match.key, match.params))) {\n        notFound();");
    });

    it("treats a broken resolver as no opinion rather than a 404", () => {
        // A database hiccup must not turn a page that exists into a 404.
        const catchAll = read("src/app/[locale]/[...slug]/page.tsx");
        const body = catchAll.slice(catchAll.indexOf("const routeExists = cache("));
        expect(body.slice(0, body.indexOf("});"))).toContain("return true;");
    });
});

describe("the route matcher still hands resolvers what they expect", () => {
    it("reports a catch-all as one slash-joined value", () => {
        const match = matchModuleRoute(["store", "product", "5", "legendary"]);
        expect(match?.params).toEqual({ params: "5/legendary" });
    });

    it("reports a single segment by name", () => {
        const match = matchModuleRoute(["player", "someone"]);
        expect(match?.params).toEqual({ username: "someone" });
    });
});
