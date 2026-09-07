import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A manifest declares where a module answers, and separately declares links
 * into it. Nothing held the two to each other.
 *
 * The trap is written into the schema already: an admin path is declared
 * panel-relative because core adds `/admin`, and "a manifest that includes it
 * too produces `/admin/admin/...`: a link to a page that does not exist".
 *
 * Two conventions live in that one file and the schema is where they are
 * settled: `menuItem.path` and `settingsCard.href` are `panelRelativePath`,
 * `dashboardCard.href` is `routePath` and names the whole thing. Writing this
 * gate from memory rather than from the schema put settings cards in the
 * wrong pool and accused fifty-one modules of a dead link they do not have.
 *
 * The class is not hypothetical. The store's search provider built
 * `/store/<slug>` while its product page is declared at
 * `/store/product/[...params]`, so every store search result was a 404;
 * `a-search-result-links-to-a-page-that-exists.test.ts` holds the search
 * providers to their routes now. This holds everything else a manifest links
 * with: the navbar, the footer, the admin menu, the settings cards and the
 * dashboard cards.
 *
 * Swept across the seventy-eight modules in the tree, every one of them
 * already lands. This keeps it that way.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const MODULE_DIR = path.join(ROOT, "module-sources");

interface Manifest {
    routes?: { path: string }[];
    adminRoutes?: { path: string }[];
    navLinks?: { href?: string }[];
    footerLinks?: { href?: string }[];
    menu?: { path?: string }[];
    settingsCards?: { href?: string }[];
    dashboardCards?: { href?: string }[];
}

/** `/store/product/[...params]` as a pattern a built link can be tested against. */
export function routeMatcher(declared: string): RegExp {
    const pattern = declared
        .split("/")
        .filter(Boolean)
        .map((segment) =>
            segment.startsWith("[")
                ? "[^/]+(?:/[^/]+)*"
                : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("/");
    return new RegExp(`^/${pattern}$`);
}

function modules(): { id: string; manifest: Manifest }[] {
    return fs
        .readdirSync(MODULE_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((id) => fs.existsSync(path.join(MODULE_DIR, id, "module.json")))
        .map((id) => ({
            id,
            manifest: JSON.parse(
                fs.readFileSync(path.join(MODULE_DIR, id, "module.json"), "utf8"),
            ) as Manifest,
        }));
}

describe("the rule a link is held to", () => {
    it("accepts a link that lands on a declared route", () => {
        expect(routeMatcher("/store/product/[...params]").test("/store/product/vip")).toBe(true);
        expect(routeMatcher("/help/[slug]").test("/help/getting-started")).toBe(true);
    });

    it("rejects the shape the schema warns about", () => {
        // `/admin` added twice is the documented way to write a dead link.
        expect(routeMatcher("/admin/blog/articles").test("/admin/admin/blog/articles")).toBe(false);
    });

    it("rejects a link that stops short of the page", () => {
        // The store search bug, in one line.
        expect(routeMatcher("/store/product/[...params]").test("/store/vip")).toBe(false);
    });
});

describe("every link a manifest declares", () => {
    const found = modules();

    it("finds the modules to check", () => {
        expect(found.length).toBeGreaterThan(50);
    });

    it("lands on a route the same module declares", () => {
        const dangling: string[] = [];

        for (const { id, manifest } of found) {
            const own = (manifest.routes ?? []).map((r) => routeMatcher(r.path));
            // An admin route is declared panel-relative: core adds the prefix.
            const admin = (manifest.adminRoutes ?? []).map((r) =>
                routeMatcher(`/admin/${r.path.replace(/^\//, "")}`),
            );
            const adminRelative = (manifest.adminRoutes ?? []).map((r) =>
                routeMatcher(`/${r.path.replace(/^\//, "")}`),
            );

            const surfaces: [string, (string | undefined)[], RegExp[]][] = [
                ["navLinks", (manifest.navLinks ?? []).map((l) => l.href), own],
                ["footerLinks", (manifest.footerLinks ?? []).map((l) => l.href), own],
                ["menu", (manifest.menu ?? []).map((l) => l.path), adminRelative],
                ["settingsCards", (manifest.settingsCards ?? []).map((l) => l.href), adminRelative],
                ["dashboardCards", (manifest.dashboardCards ?? []).map((l) => l.href), admin],
            ];

            for (const [surface, links, pool] of surfaces) {
                for (const link of links) {
                    if (typeof link !== "string" || !link.startsWith("/")) continue;
                    if (pool.some((m) => m.test(link))) continue;
                    dangling.push(`${id} ${surface}: ${link}`);
                }
            }
        }

        expect(
            dangling,
            `These link somewhere the module does not declare a route for:\n${dangling.join("\n")}`,
        ).toEqual([]);
    });
});
