import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guards for the two shapes that turn every error page into a soft 200.
 *
 * Next commits the HTTP status when it flushes the shell. Anything that puts
 * the page inside a Suspense boundary lets the shell go out first, so a later
 * `notFound()`, `redirect()` or thrown error can no longer set 404, 307 or
 * 500 - the body arrives streamed into a response that already said 200.
 */

const root = path.resolve(import.meta.dirname, "../..");

describe("context provider registry", () => {
    const generator = fs.readFileSync(path.join(root, "scripts/generate-registry.ts"), "utf8");

    it("emits context providers as static imports", () => {
        const block = generator.slice(
            generator.indexOf("let contextImports"),
            generator.indexOf("let slotImports"),
        );
        expect(block).not.toContain("dynamic(");
        expect(block).toContain("import * as ${ns}");
    });
});

describe("catch-all segments", () => {
    /** Every `[...slug]` directory under src/app. */
    function catchAllDirs(dir: string, found: string[] = []): string[] {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const full = path.join(dir, entry.name);
            if (/^\[\.\.\..+\]$/.test(entry.name)) found.push(full);
            catchAllDirs(full, found);
        }
        return found;
    }

    it("has no loading.tsx next to a catch-all page", () => {
        const offenders = catchAllDirs(path.join(root, "src/app"))
            .filter((dir) => fs.existsSync(path.join(dir, "loading.tsx")))
            .map((dir) => path.relative(root, dir));
        expect(offenders).toEqual([]);
    });

    it("still finds the catch-all pages it is guarding", () => {
        const dirs = catchAllDirs(path.join(root, "src/app"));
        expect(dirs.length).toBeGreaterThan(0);
    });
});

/**
 * The admin namespace is roughly four fifths of the core catalogue and was
 * being serialised into every public page. The locale layout trims it; the
 * admin layout puts it back for the tree that renders it. Either half missing
 * is a bug that only shows up as a broken admin panel or a fat public page.
 */
describe("admin message scoping", () => {
    it("trims the admin namespace in the locale layout", () => {
        const layout = fs.readFileSync(path.join(root, "src/app/[locale]/layout.tsx"), "utf8");
        expect(layout).toContain("withoutAdminNamespaces(messages)");
    });

    it("re-provides the full catalogue in the admin layout", () => {
        const layout = fs.readFileSync(path.join(root, "src/app/[locale]/(admin)/admin/layout.tsx"), "utf8");
        expect(layout).toContain("NextIntlClientProvider");
        expect(layout).toContain("await getMessages()");
    });
});
