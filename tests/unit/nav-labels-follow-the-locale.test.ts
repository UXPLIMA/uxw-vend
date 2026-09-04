import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A module's entry in the navbar, the footer and the mobile bar is its own
 * name, and it was the one string in the navigation that never followed the
 * locale. A Turkish site showed "Store" and "Punishments" sitting between a
 * translated "Ana Sayfa" and "Giris Yap", because the manifest carried only a
 * literal `label` and all three renderers printed it verbatim.
 *
 * Four modules had already shipped the translation - blog, forum, store and
 * help-center each merged a `nav.*` string into the shared namespace - and
 * nothing read it. The manifest now carries `labelKey` beside `label`; the
 * renderers resolve the key in the `nav` namespace and fall back to the
 * literal, which is what an admin's own typed label is.
 *
 * This gate holds the three parts together: every public nav or footer link a
 * module declares names a key, the key resolves in every locale the module
 * ships, no two modules claim the same key, and the renderers still go
 * through the key rather than printing the label.
 */

const ROOT = path.resolve(__dirname, "../..");
const SOURCES = path.join(ROOT, "module-sources");

interface Manifest {
    id: string;
    navLinks?: { label: string; labelKey?: string; href: string }[];
    footerLinks?: { label: string; labelKey?: string; href: string }[];
    translations?: Record<string, Record<string, Record<string, unknown>>>;
}

function manifests(): Manifest[] {
    return fs.readdirSync(SOURCES, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(SOURCES, e.name, "module.json"))
        .filter((p) => fs.existsSync(p))
        .map((p) => JSON.parse(fs.readFileSync(p, "utf8")) as Manifest);
}

/** Every public navigation entry a manifest declares. */
export function publicLinks(m: Manifest) {
    return [
        ...(m.navLinks ?? []).map((l) => ({ ...l, where: "navLinks" })),
        ...(m.footerLinks ?? []).map((l) => ({ ...l, where: "footerLinks" })),
    ];
}

describe("module navigation labels", () => {
    const all = manifests();

    it("finds the manifests and the links", () => {
        expect(all.length).toBeGreaterThan(40);
        expect(all.flatMap(publicLinks).length).toBeGreaterThan(10);
    });

    it("names a translation key on every nav and footer link", () => {
        const missing: string[] = [];
        for (const m of all) {
            for (const link of publicLinks(m)) {
                if (!link.labelKey) missing.push(`${m.id}.${link.where} ${link.href}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it("ships the key in every locale the module translates", () => {
        const gaps: string[] = [];
        for (const m of all) {
            const keys = new Set(publicLinks(m).map((l) => l.labelKey).filter(Boolean) as string[]);
            if (keys.size === 0) continue;
            const locales = Object.keys(m.translations ?? {});
            expect(locales.length, `${m.id} declares links but no translations`).toBeGreaterThan(0);
            for (const locale of locales) {
                const nav = (m.translations?.[locale]?.nav ?? {}) as Record<string, unknown>;
                for (const key of keys) {
                    if (typeof nav[key] !== "string" || !(nav[key] as string).trim()) {
                        gaps.push(`${m.id} ${locale} nav.${key}`);
                    }
                }
            }
        }
        expect(gaps).toEqual([]);
    });

    it("gives each module its own key, since the namespace is shared", () => {
        // Module translations merge into one `nav` namespace, so two modules
        // claiming the same key means whichever installs last wins and the
        // other module's label silently changes.
        const owner = new Map<string, string>();
        const clashes: string[] = [];
        for (const m of all) {
            for (const key of new Set(publicLinks(m).map((l) => l.labelKey).filter(Boolean) as string[])) {
                const previous = owner.get(key);
                if (previous && previous !== m.id) clashes.push(`nav.${key}: ${previous} and ${m.id}`);
                owner.set(key, m.id);
            }
        }
        expect(clashes).toEqual([]);
    });

    it("carries the same string in core's own message files", () => {
        // A site whose module translations have not been seeded yet still has
        // to render a label rather than the raw key.
        const gaps: string[] = [];
        for (const locale of ["en", "tr"]) {
            const core = JSON.parse(fs.readFileSync(path.join(ROOT, `messages-core/${locale}.json`), "utf8"));
            for (const m of all) {
                for (const key of new Set(publicLinks(m).map((l) => l.labelKey).filter(Boolean) as string[])) {
                    if (typeof core.nav?.[key] !== "string") gaps.push(`${locale} nav.${key} (${m.id})`);
                }
            }
        }
        expect(gaps).toEqual([]);
    });
});

describe("the manifest contract", () => {
    const schema = fs.readFileSync(path.join(ROOT, "src/core/lib/module-manifest-schema.ts"), "utf8");

    it("accepts labelKey on both link kinds", () => {
        const navLink = schema.slice(schema.indexOf("const navLink = z.object("));
        expect(navLink.slice(0, navLink.indexOf("});"))).toContain("labelKey");
        const footerLink = schema.slice(schema.indexOf("const footerLink = z.object("));
        expect(footerLink.slice(0, footerLink.indexOf("});"))).toContain("labelKey");
    });

    it("carries it through the generated registry", () => {
        const gen = fs.readFileSync(path.join(ROOT, "scripts/generate-registry.ts"), "utf8");
        expect(gen).toContain("export const ModuleNavLinks: { label: string; labelKey?: string;");
        expect(gen).toContain("export const ModuleFooterLinks: { label: string; labelKey?: string;");
    });
});

describe("the renderers", () => {
    const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

    it("resolves the key in the navbar", () => {
        const src = read("src/core/components/layout/Navbar.tsx");
        expect(src).toContain("link.labelKey && t.has(link.labelKey) ? t(link.labelKey) : link.label");
        // registry links and admin-configured links both go through it
        expect(src).toContain("label: navLabel(nl)");
        expect(src).toContain("label: navLabel(link)");
    });

    it("resolves the key in the footer", () => {
        const src = read("src/core/components/layout/Footer.tsx");
        expect(src).toContain("fl.labelKey && navT.has(fl.labelKey) ? navT(fl.labelKey) : fl.label");
    });

    it("resolves the key in the mobile bar", () => {
        const src = read("src/core/components/layout/MobileBottomNav.tsx");
        expect(src).toContain("nl.labelKey && navT.has(nl.labelKey) ? navT(nl.labelKey) : nl.label");
    });

    it("keeps the key when the navbar editor seeds itself from the registry", () => {
        // Seeding dropped labelKey, so an admin who opened the editor and hit
        // save froze every module's label in English for every locale.
        const src = read("src/app/[locale]/(admin)/admin/settings/navbar/page.tsx");
        expect(src).toContain("labelKey: nl.labelKey");
        expect(src).toContain('labelKey: "home"');
        // and drops it once the admin types their own text
        expect(src).toContain('if (field === "label") return { ...l, label: value, labelKey: undefined };');
    });
});
