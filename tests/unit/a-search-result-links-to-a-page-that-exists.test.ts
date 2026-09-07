import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A search result is a link, and one of them went nowhere.
 *
 * `/api/v1/search` fans out to each enabled module's provider and every
 * provider builds an `href` by hand. The store built `/store/${slug}`, and
 * the page it meant is declared at `/store/product/[...params]`: searching
 * this install for "vip" answered with `/store/vip-uyelik-demo`, which is a
 * 404, while `/store/product/vip-uyelik-demo` is a 200.
 *
 * The other three agree with their own manifests, which is what makes this a
 * typo rather than a convention: `/blog/${slug}` against `/blog/[...params]`,
 * `/forum/topic/${slug}` against `/forum/topic/[...params]`,
 * `/help/${slug}` against `/help/[slug]`.
 *
 * So the rule is the manifest: a provider may only send a reader to a path
 * one of its module's own routes would answer.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const MODULE_DIR = path.join(ROOT, "module-sources");

/** `/store/product/[...params]` -> a regex that matches a built href. */
function routeMatcher(declared: string): RegExp {
    const pattern = declared
        .split("/")
        .filter(Boolean)
        .map((segment) =>
            segment.startsWith("[") ? "[^/]+(?:/[^/]+)*" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("/");
    return new RegExp(`^/${pattern}$`);
}

/** The literal part of an href template: `/store/${r.slug}` -> `/store/x`. */
function sample(template: string): string {
    return template.replace(/\$\{[^}]*\}/g, "x");
}

interface Provider {
    module: string;
    hrefs: string[];
    routes: string[];
}

function providers(): Provider[] {
    return fs
        .readdirSync(MODULE_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((id) => fs.existsSync(path.join(MODULE_DIR, id, "search", "handler.ts")))
        .map((id) => {
            const handler = fs.readFileSync(path.join(MODULE_DIR, id, "search", "handler.ts"), "utf8");
            const manifest = JSON.parse(
                fs.readFileSync(path.join(MODULE_DIR, id, "module.json"), "utf8"),
            ) as { routes?: { path: string }[] };
            return {
                module: id,
                hrefs: [...new Set([...handler.matchAll(/href:\s*`([^`]+)`/g)].map((m) => m[1]))],
                routes: (manifest.routes ?? []).map((r) => r.path),
            };
        });
}

describe("a search result", () => {
    const found = providers();

    it("finds the providers to check", () => {
        expect(found.length).toBeGreaterThanOrEqual(4);
        for (const p of found) {
            expect(p.hrefs.length, `${p.module} builds no href`).toBeGreaterThan(0);
        }
    });

    it("links to a path its own module declares a route for", () => {
        const dangling: string[] = [];
        for (const p of found) {
            const matchers = p.routes.map(routeMatcher);
            for (const href of p.hrefs) {
                const target = sample(href);
                if (!matchers.some((m) => m.test(target))) {
                    dangling.push(`${p.module}: ${href} matches none of ${p.routes.join(", ")}`);
                }
            }
        }
        expect(
            dangling,
            `These send a reader to a path the module does not serve:\n${dangling.join("\n")}`,
        ).toEqual([]);
    });
});
