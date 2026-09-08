/**
 * A public page a module ships can be reached from the navigation.
 *
 * Seven modules shipped a page and no way to get to it. `/leaderboard`,
 * `/staff`, `/downloads`, `/vote`, `/wheel` and `/referral` were installed,
 * enabled, translated and served - and linked from nowhere at all, so on a
 * fresh install the only way to a leaderboard was to type its path. The
 * navigation is built from what the manifests declare, and none of those six
 * declared a nav link.
 *
 * The rule is about destinations: a one-segment public route is somewhere a
 * visitor goes, so something has to lead there. A deeper path (`/store/cart`,
 * `/support/new`) is reached from the section it belongs to, and the pages
 * below are named with the reason they are not destinations.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCES = path.join(ROOT, "module-sources");

interface Manifest {
    id: string;
    routes?: { path: string; isAdmin?: boolean }[];
    navLinks?: { href: string; label: string; labelKey?: string }[];
    translations?: Record<string, Record<string, Record<string, string>>>;
}

/** Public routes that are not somewhere a visitor sets out for. */
const NOT_A_DESTINATION: Record<string, string> = {
    "/notifications": "One reader's own notifications, opened from the bell that counts them. A link on the public bar would read as a section of the site.",
    "/auth/steam": "The screen a Steam sign-in returns through. Nobody navigates to it; it hands off to a redirect.",
};

function manifests(): Manifest[] {
    return fs.readdirSync(SOURCES)
        .map((id) => path.join(SOURCES, id, "module.json"))
        .filter((file) => fs.existsSync(file))
        .map((file) => JSON.parse(fs.readFileSync(file, "utf8")) as Manifest);
}

/** Public, static, one segment deep: a place rather than a step. */
function destinations(manifest: Manifest): string[] {
    return (manifest.routes ?? [])
        .filter((route) => !route.isAdmin)
        .map((route) => (route.path.startsWith("/") ? route.path : `/${route.path}`))
        .filter((href) => !href.includes("["))
        .filter((href) => href.split("/").filter(Boolean).length === 1)
        .filter((href) => !NOT_A_DESTINATION[href]);
}

describe("the pages the modules ship", () => {
    const all = manifests();

    it("finds manifests to check", () => {
        expect(all.length).toBeGreaterThan(50);
        expect(all.flatMap(destinations).length).toBeGreaterThan(10);
    });

    it("leads to every one of them from the navigation", () => {
        const unreachable: string[] = [];
        for (const manifest of all) {
            const linked = new Set((manifest.navLinks ?? []).map((l) => l.href));
            for (const href of destinations(manifest)) {
                if (!linked.has(href)) unreachable.push(`${manifest.id}: ${href}`);
            }
        }
        expect(unreachable).toEqual([]);
    });

    it("names each of those links in both languages, not in the manifest's English", () => {
        // `label` is the fallback for a module that declares no key; a first
        // party module carries the word in both catalogues.
        const untranslated: string[] = [];
        for (const manifest of all) {
            for (const link of manifest.navLinks ?? []) {
                if (!link.labelKey) { untranslated.push(`${manifest.id}: ${link.href} has no labelKey`); continue; }
                for (const locale of ["en", "tr"]) {
                    const word = manifest.translations?.[locale]?.nav?.[link.labelKey];
                    if (!word) untranslated.push(`${manifest.id}: ${link.labelKey} missing in ${locale}`);
                }
            }
        }
        expect(untranslated).toEqual([]);
    });

    it("keeps the exception list to routes that exist", () => {
        const every = new Set(
            all.flatMap((m) => (m.routes ?? []).map((r) => (r.path.startsWith("/") ? r.path : `/${r.path}`))),
        );
        for (const [href, reason] of Object.entries(NOT_A_DESTINATION)) {
            expect(every.has(href), href).toBe(true);
            expect(reason.length, `${href} needs a real reason`).toBeGreaterThan(40);
        }
    });
});
