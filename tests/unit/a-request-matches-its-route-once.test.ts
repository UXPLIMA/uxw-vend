import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { matchModuleRouteOnce } from "@/core/lib/route-matcher";

/**
 * A request works out which module page it is asking for once.
 *
 * The dynamic page asks twice by design: `generateMetadata` runs, then the
 * page component. Both called `matchModuleRoute(slug)` for themselves, so each
 * got its own `RouteMatch` and its own `params` object - and `routeExists`,
 * the thing that decides whether the page exists at all, is a React `cache`,
 * which keys on argument identity. Handed a fresh object every time it never
 * hit once, while the comment beside it said it kept the resolver "to one call
 * per request".
 *
 * Measured against the development server with five thousand articles seeded,
 * warm, same page twice: one article page ran the same
 * `select id from BlogArticle where slug = ? and status = ?` six times before
 * and three after. Not one, because that server renders twice and the two asks
 * are separate request scopes; what went is the duplication inside each ask.
 *
 * The check is structural because React's `cache` is inert outside a request -
 * measured, not assumed: in this test environment it calls straight through
 * and memoises nothing, so no unit test can watch it hit. What a test can hold
 * is that the page asks through the memo and that the memo's key is something
 * a memo can compare.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE = "src/app/[locale]/[...slug]/page.tsx";

function source(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("matching a module route", () => {
    it("still finds the route it is given", () => {
        const both = [matchModuleRouteOnce("blog"), matchModuleRouteOnce("blog")];
        expect(both[0]).toEqual(both[1]);
    });

    it("answers nothing for a path no module claims", () => {
        expect(matchModuleRouteOnce("no-module-claims-this-path")).toBeNull();
    });

    it("is keyed on a string, because a memo cannot compare two equal objects", () => {
        const matcher = source("src/core/lib/route-matcher.ts");
        expect(matcher).toMatch(/matchModuleRouteOnce = cache\(\(urlPath: string\)/);
    });

    it("is how the dynamic page asks, so its two asks share one answer", () => {
        const page = source(PAGE);
        const direct = [...page.matchAll(/\bmatchModuleRoute\s*\(/g)];
        expect(
            direct.map((m) => page.slice(0, m.index).split("\n").length),
            "the page should ask through matchModuleRouteOnce; a direct call gets its own object",
        ).toEqual([]);
        expect([...page.matchAll(/matchModuleRouteOnce\(/g)].length).toBeGreaterThanOrEqual(2);
    });
});
