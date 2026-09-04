import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A boundary file renders a document exactly when nothing above it does.
 *
 * `not-found.tsx` and `error.tsx` are composed inside the layouts above them,
 * so one that carries its own `<html>` puts a document inside a document.
 * React fails that on the server and streams an empty `__next_error__` shell
 * with the right status and no content: the markup only appears once the
 * client has run, so a crawler, a text browser and a reader with scripting off
 * see a blank page. `app/[locale]/not-found.tsx` shipped that way.
 *
 * The inverse is the same bug from the other side. This app's root layout is
 * `app/[locale]/layout.tsx`, a top-level dynamic segment, so a boundary that
 * sits above `[locale]` has no layout to compose with and has to supply the
 * document itself.
 *
 * `global-error.tsx` is the documented exception: it replaces the root layout
 * rather than rendering inside it, so it always carries a document.
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions.
 */

const APP = path.join(process.cwd(), "src/app");
const BOUNDARIES = new Set(["not-found.tsx", "error.tsx"]);

/**
 * Comments out, so that a file explaining why it renders no document does not
 * read as one that does.
 */
export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Does this file render a document root of its own? */
export function rendersDocument(source: string): boolean {
    return /<html[\s>]/.test(stripComments(source));
}

/**
 * The nearest layout at or above `dir` that renders a document, if any.
 *
 * A segment's own `layout.tsx` wraps that segment's boundary files, so the
 * search starts in the file's own directory rather than its parent.
 */
export function documentAncestor(dir: string, appRoot: string, read: (p: string) => string | null): string | null {
    let current = dir;
    for (;;) {
        const layout = path.join(current, "layout.tsx");
        const source = read(layout);
        if (source !== null && rendersDocument(source)) return layout;
        if (path.resolve(current) === path.resolve(appRoot)) return null;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

const readOrNull = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

function boundaryFiles(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (BOUNDARIES.has(entry.name)) {
                found.push(full);
            }
        }
    };
    walk(APP);
    return found.sort();
}

describe("app shell documents", () => {
    const files = boundaryFiles();

    it("finds the boundary files it is meant to check", () => {
        expect(files.length).toBeGreaterThanOrEqual(4);
    });

    it("no boundary renders a document inside a layout that already does", () => {
        const nested = files.filter((file) => {
            const wrapper = documentAncestor(path.dirname(file), APP, readOrNull);
            return wrapper !== null && rendersDocument(fs.readFileSync(file, "utf8"));
        });
        expect(nested.map((f) => path.relative(APP, f))).toEqual([]);
    });

    it("every boundary with no document above it supplies one", () => {
        const bare = files.filter((file) => {
            const wrapper = documentAncestor(path.dirname(file), APP, readOrNull);
            return wrapper === null && !rendersDocument(fs.readFileSync(file, "utf8"));
        });
        expect(bare.map((f) => path.relative(APP, f))).toEqual([]);
    });

    it("global-error carries its own document", () => {
        const globalError = path.join(APP, "global-error.tsx");
        expect(fs.existsSync(globalError)).toBe(true);
        expect(rendersDocument(fs.readFileSync(globalError, "utf8"))).toBe(true);
    });

    it("the locale not-found renders content, and the root one renders a document", () => {
        expect(rendersDocument(fs.readFileSync(path.join(APP, "[locale]/not-found.tsx"), "utf8"))).toBe(false);
        expect(rendersDocument(fs.readFileSync(path.join(APP, "not-found.tsx"), "utf8"))).toBe(true);
    });

    // Self-tests: the checks above are only worth their runtime if they fail
    // on the shapes they exist to catch.
    it("rendersDocument sees a document root and nothing else", () => {
        expect(rendersDocument('return <html lang="en"><body /></html>;')).toBe(true);
        expect(rendersDocument("return <html>\n<body />\n</html>;")).toBe(true);
        expect(rendersDocument('return <div className="html-ish" />;')).toBe(false);
    });

    it("rendersDocument ignores a document named in a comment", () => {
        expect(rendersDocument("/** used to carry its own <html> and <body>. */\nreturn <main />;")).toBe(false);
        expect(rendersDocument("// never render <html> here\nreturn <main />;")).toBe(false);
        expect(rendersDocument("/* comment */\nreturn <html><body /></html>;")).toBe(true);
    });

    it("stripComments leaves a protocol-relative URL alone", () => {
        expect(stripComments('const u = "https://example.test/x"; // trailing')).toBe('const u = "https://example.test/x"; ');
    });

    it("documentAncestor walks up and stops at the app root", () => {
        const layouts: Record<string, string> = {
            "/app/[locale]/layout.tsx": "<html><body>{children}</body></html>",
        };
        const read = (p: string) => layouts[p] ?? null;
        expect(documentAncestor("/app/[locale]/(public)/blog", "/app", read)).toBe("/app/[locale]/layout.tsx");
        expect(documentAncestor("/app/[locale]", "/app", read)).toBe("/app/[locale]/layout.tsx");
        expect(documentAncestor("/app", "/app", read)).toBeNull();
    });

    it("documentAncestor ignores a layout that renders no document", () => {
        const read = (p: string) => (p === "/app/[locale]/layout.tsx" ? "<div>{children}</div>" : null);
        expect(documentAncestor("/app/[locale]/blog", "/app", read)).toBeNull();
    });
});
