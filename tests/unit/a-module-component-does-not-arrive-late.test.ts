/**
 * Why the homepage jumped.
 *
 * Every component a module contributes to a page - a widget, a homepage
 * section, a profile tab, something in the navbar, the footer or another
 * module's slot - was emitted by the registry generator as a `next/dynamic`
 * import with `loading: () => null`. The parent that renders them is a client
 * component, so `dynamic` cannot render them on the server either: measured
 * against a production build, the server HTML for the homepage contained none
 * of the widget markup at all.
 *
 * So the page painted a shell, and about a second later eight chunks landed
 * and put roughly 1200px of cards into the sidebar at once. Everything below
 * moved, which for the footer meant leaving the viewport entirely. Cumulative
 * layout shift measured 0.29 against a 0.1 budget - "poor" by the measure
 * Google publishes, and the e2e suite has a spec that says so.
 *
 * `dynamic` was buying nothing here. The generator only emits an entry for a
 * module that is installed, so the import path always resolves at build time;
 * there is no runtime question for a lazy import to answer. What it cost was a
 * second round trip and a component that renders nothing until it arrives.
 *
 * A static import has no loading state, so there is nothing to render nothing
 * *as*. The trade is that these components share a chunk with the registry
 * rather than having their own, which for a handful of small cards that appear
 * on the page anyway is the better half of the deal.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COMPONENTS = path.join(ROOT, "src/core/generated/module-components.tsx");
const REGISTRY = path.join(ROOT, "src/core/generated/module-registry.tsx");
const GENERATOR = path.join(ROOT, "scripts/generate-registry.ts");

/** The registries whose components are rendered in place on a page. */
const IN_PAGE_REGISTRIES = [
    "WidgetComponentRegistry",
    "HomepageSectionRegistry",
    "ProfileTabRegistry",
    "LayoutComponentRegistry",
    "NavbarComponentRegistry",
    "FooterComponentRegistry",
    "SlotContentRegistry",
];

describe("the generated component registry", () => {
    const registry = fs.readFileSync(COMPONENTS, "utf8");

    it("has the registries this is about", () => {
        // Without this the checks below pass on a file that stopped emitting
        // them, which is not the same as passing.
        for (const name of IN_PAGE_REGISTRIES) {
            expect(registry, name).toContain(`export const ${name}`);
        }
    });

    it("renders no component as nothing while it loads", () => {
        // The one line that produced the shift, thirty times over.
        expect(registry).not.toContain("loading: () => null");
    });

    it("imports a page component rather than fetching it later", () => {
        // A module page is a route of its own and may still be split; these
        // are pieces of a page that is already being rendered.
        for (const name of IN_PAGE_REGISTRIES) {
            const start = registry.indexOf(`export const ${name}`);
            const end = registry.indexOf("};", start);
            const block = registry.slice(start, end);
            expect(block, `${name} still lazy-loads its components`).not.toContain("dynamic(");
        }
    });
});

describe("the generator", () => {
    it("is where the fix lives, so the next module inherits it", () => {
        const source = fs.readFileSync(GENERATOR, "utf8");
        expect(source).not.toContain("loading: () => ${loadingExpr}");
    });
});

/**
 * The component maps live in their own file now.
 *
 * They hold real imports rather than lazy ones, so reading one pulls every
 * widget, tab and slot a module contributes, and with them next-intl, the icon
 * set and whatever else those components reach for. The arrays beside them are
 * plain JSON that server code and tests read constantly. Six test suites went
 * from reading an array to failing on a client-only import the first time the
 * two shared a file.
 */
describe("the data a module declares", () => {
    it("is readable without loading a single component", () => {
        const registry = fs.readFileSync(REGISTRY, "utf8");
        expect(registry).not.toContain("import * as mod");
        for (const name of IN_PAGE_REGISTRIES) {
            expect(registry, `${name} belongs in module-components.tsx`).not.toContain(
                `export const ${name}`,
            );
        }
    });

    it("still holds the arrays the server reads", () => {
        const registry = fs.readFileSync(REGISTRY, "utf8");
        for (const name of ["ModuleRoutes", "ModuleApiRoutes", "ModuleUserDataTables", "ModuleWidgets"]) {
            expect(registry, name).toContain(`export const ${name}`);
        }
    });
});
