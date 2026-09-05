import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CORE_NAV_GROUPS } from "@/core/lib/admin-nav-groups";

/**
 * A screen nobody can navigate to, and a screen a module cannot get past.
 *
 * Core carries forty-one admin pages. The sidebar lists thirty-four of them,
 * the `/admin/settings` card grid lists a partly different set, and the
 * spotlight search carries a hardcoded list of twelve. Nothing compared the
 * three against the pages on disk, so a page could be shipped, guarded,
 * translated and wired to a working API while being reachable only by typing
 * its URL.
 *
 * Four were. `/admin/settings/moderation` is the only writer of the
 * `moderation` setting, which `forum` reads to decide whether a new topic is
 * PENDING or APPROVED: the Moderation Queue was in the sidebar and the switch
 * that fills it was not. `/admin/setup` is a second onboarding wizard that
 * installs modules and writes site settings. `/admin/dev` inspects the hook
 * and registry tables. `/admin/seo` was the fourth, and was worse than
 * unreachable - see below.
 *
 * The second half of this file is the shadowing rule. Module pages are served
 * by three catch-alls, and a catch-all is the App Router's lowest-priority
 * match, so a core file with the same literal segments answers first and the
 * module's page is never reached. Core's `/admin/seo` was a dead stub - it
 * wrote eight global settings plus a title and description per page, and no
 * code anywhere read one of them, so its "Saved" toast was a lie - and it sat
 * exactly where the `seo` module mounts its real admin screen. Installing SEO
 * Manager put a working link in the sidebar that landed on the stub. It has
 * been deleted; this test keeps the collision from coming back, for that path
 * and for every other one a module might claim.
 */

const ROOT = process.cwd();
const ADMIN_ROOT = path.join(ROOT, "src/app/[locale]/(admin)");

/** Every admin URL core renders with a file of its own. */
function coreAdminPages(): string[] {
    const out: string[] = [];
    const walk = (dir: string, url: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        if (entries.some((e) => e.isFile() && e.name === "page.tsx")) out.push(url);
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const grouped = entry.name.startsWith("(") && entry.name.endsWith(")");
            walk(path.join(dir, entry.name), grouped ? url : `${url}/${entry.name}`);
        }
    };
    walk(ADMIN_ROOT, "");
    return out.filter((u) => !u.includes("[")).sort();
}

/** Every `/admin/...` string literal core links to, wherever it is written. */
function linkedAdminUrls(): Map<string, string[]> {
    const found = new Map<string, string[]>();
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules") walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry.name)) continue;
            const source = fs.readFileSync(full, "utf8");
            for (const m of source.matchAll(/["'`](\/admin[/\w\-.]*)["'`]/g)) {
                // The page's own file is not a way in.
                const own = path.join(ADMIN_ROOT, m[1].replace(/^\/admin/, "admin"));
                if (full.startsWith(own + path.sep) || full === path.join(own, "page.tsx")) continue;
                found.set(m[1], [...(found.get(m[1]) ?? []), path.relative(ROOT, full)]);
            }
        }
    };
    walk(path.join(ROOT, "src"));
    return found;
}

/**
 * Admin pages that are deliberately reachable by URL only. Each entry is a
 * decision, not a backlog: adding one means the screen is not meant to be
 * navigated to.
 */
const URL_ONLY_BY_DESIGN: Record<string, string> = {};

describe("every core admin screen", () => {
    const pages = coreAdminPages();
    const links = linkedAdminUrls();

    it("is found by the scan at all", () => {
        expect(pages.length).toBeGreaterThan(30);
        expect(pages).toContain("/admin/settings/moderation");
    });

    it("is linked from somewhere, or listed here on purpose", () => {
        const orphans = pages.filter((p) => !links.has(p) && !(p in URL_ONLY_BY_DESIGN));
        expect(orphans).toEqual([]);
    });

    it("names no screen as URL-only that something links anyway", () => {
        const stale = Object.keys(URL_ONLY_BY_DESIGN).filter((p) => links.has(p));
        expect(stale).toEqual([]);
    });
});

describe("the sidebar", () => {
    const hrefs = CORE_NAV_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.items.map((i) => i.href)));

    it("points every item at a page that exists", () => {
        const pages = new Set(coreAdminPages());
        const dangling = hrefs.filter((h) => !pages.has(h));
        expect(dangling).toEqual([]);
    });

    it("carries the moderation switch next to the queue it fills", () => {
        expect(hrefs).toContain("/admin/moderation");
        expect(hrefs).toContain("/admin/settings/moderation");
    });

    it("resolves each item to the group that declares it", () => {
        // `/admin/settings/moderation` lives in Content while
        // `/admin/settings` is the Settings group's prefix, so the longest
        // prefix has to win or the sidebar highlights the wrong rail icon.
        for (const group of CORE_NAV_GROUPS) {
            const prefixes = Array.isArray(group.pathPrefix)
                ? group.pathPrefix
                : group.pathPrefix
                    ? [group.pathPrefix]
                    : [];
            for (const item of group.sections.flatMap((s) => s.items)) {
                if (item.href === "/admin") continue;
                const owner = CORE_NAV_GROUPS
                    .flatMap((g) => (Array.isArray(g.pathPrefix) ? g.pathPrefix : g.pathPrefix ? [g.pathPrefix] : []).map((p) => ({ g, p })))
                    .filter(({ p }) => item.href === p || item.href.startsWith(p + "/"))
                    .sort((x, y) => y.p.length - x.p.length)[0];
                expect(owner, item.href).toBeDefined();
                if (prefixes.some((p) => item.href === p || item.href.startsWith(p + "/"))) {
                    expect(owner!.g.id, item.href).toBe(group.id);
                }
            }
        }
    });
});

describe("no core page shadows a module route", () => {
    /** Core URLs that answer before a catch-all, per surface. */
    function coreUrls(base: string, prefix: string, leaf: string): { url: string; file: string }[] {
        const out: { url: string; file: string }[] = [];
        const walk = (dir: string, url: string) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            if (entries.some((e) => e.isFile() && e.name === leaf)) {
                out.push({ url: url || "/", file: path.relative(ROOT, path.join(dir, leaf)) });
            }
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                if (/^\[\[?\.\.\./.test(entry.name)) continue; // the dispatcher itself
                const grouped = entry.name.startsWith("(") && entry.name.endsWith(")");
                walk(path.join(dir, entry.name), grouped ? url : `${url}/${entry.name}`);
            }
        };
        walk(path.join(ROOT, base), prefix);
        return out;
    }

    const core = [
        ...coreUrls("src/app/[locale]", "", "page.tsx"),
        ...coreUrls("src/app/api/v1", "/api/v1", "route.ts"),
    ];

    function declared(): { module: string; kind: string; url: string }[] {
        const dir = path.join(ROOT, "module-sources");
        const out: { module: string; kind: string; url: string }[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const file = path.join(dir, entry.name, "module.json");
            if (!fs.existsSync(file)) continue;
            const m = JSON.parse(fs.readFileSync(file, "utf8")) as {
                id: string;
                routes?: { path: string }[];
                adminRoutes?: { path: string }[];
                api?: { path: string }[];
            };
            for (const r of m.routes ?? []) out.push({ module: m.id, kind: "route", url: r.path });
            for (const r of m.adminRoutes ?? []) out.push({ module: m.id, kind: "adminRoute", url: `/admin${r.path}` });
            for (const r of m.api ?? []) out.push({ module: m.id, kind: "api", url: `/api/v1${r.path}` });
        }
        return out;
    }

    /** Same depth, and every core segment either literal-equal or dynamic. */
    const shadows = (coreUrl: string, moduleUrl: string) => {
        const a = coreUrl.split("/").filter(Boolean);
        const b = moduleUrl.split("/").filter(Boolean);
        return a.length === b.length && a.every((s, i) => s.startsWith("[") || s === b[i]);
    };

    it("has both sides to compare", () => {
        expect(core.length).toBeGreaterThan(90);
        expect(declared().length).toBeGreaterThan(200);
    });

    it("leaves every declared module route reachable", () => {
        const blocked = declared()
            .map((d) => {
                const owner = core.find((c) => shadows(c.url, d.url));
                return owner ? `${d.module}: ${d.kind} ${d.url} answered by ${owner.file}` : null;
            })
            .filter(Boolean);
        expect(blocked).toEqual([]);
    });

    it("would notice the collision that was there", () => {
        // The shape of the one this found, asserted directly so the rule
        // above cannot pass by measuring nothing.
        expect(shadows("/admin/seo", "/admin/seo")).toBe(true);
        expect(shadows("/admin/users/[id]", "/admin/users/42")).toBe(true);
        expect(shadows("/admin/seo", "/admin/seo/pages")).toBe(false);
        expect(shadows("/admin/settings", "/admin/seo")).toBe(false);
    });
});

describe("the SEO screen core used to carry", () => {
    it("is gone from core", () => {
        expect(fs.existsSync(path.join(ADMIN_ROOT, "admin/seo"))).toBe(false);
    });

    it("takes its orphaned translation keys with it", () => {
        // Thirty-six keys served that page and nothing else. A key with no
        // reader is a string a translator is asked to translate for nobody.
        for (const locale of ["en", "tr"]) {
            const messages = JSON.parse(
                fs.readFileSync(path.join(ROOT, `messages-core/${locale}.json`), "utf8"),
            ) as { admin: Record<string, string> };
            const left = Object.keys(messages.admin).filter((k) => k.startsWith("seo_"));
            expect(left, locale).toEqual([]);
        }
    });

    it("leaves the module as the only owner of SEO settings", () => {
        const manifest = JSON.parse(
            fs.readFileSync(path.join(ROOT, "module-sources/seo/module.json"), "utf8"),
        ) as { adminRoutes: { path: string }[] };
        expect(manifest.adminRoutes.map((r) => r.path)).toContain("/seo");
    });
});
