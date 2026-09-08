import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Author-written HTML reaches the page through one component.
 *
 * Seven module screens each imported DOMPurify, called `sanitize` with its
 * own defaults, and rendered the result through `prose dark:prose-invert` -
 * class names that match nothing, because the typography plugin was never
 * installed here. So the writing on the blog, the forum, the help centre, the
 * changelog, custom pages and every product description came out with
 * body-sized headings and unmarked lists, and seven sanitiser configurations
 * were free to drift apart.
 *
 * Six of the seven imported plain `dompurify`, which needs a window. They are
 * client components whose content arrives after mount, so the first render
 * has nothing to sanitise and the missing DOM never shows. That is luck, not
 * design: the day one of them renders its content on the server, it throws.
 *
 * `RichContent` is the one place. It sanitises with the isomorphic build and
 * styles with `.uxw-content`, in the theme's colours.
 */

const ROOT = path.resolve(__dirname, "../..");

function tsxFiles(dir: string, into: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return into;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules") tsxFiles(full, into);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
            into.push(full);
        }
    }
    return into;
}

const MODULE_FILES = tsxFiles(path.join(ROOT, "module-sources"));
const rel = (file: string) => path.relative(ROOT, file);

/** Structured data is markup for a crawler, not writing for a reader. */
const JSON_LD = /Jsonld|JsonLd|jsonLd|JSON_LD/;

/** The core version that first exported RichContent. */
const INTRODUCED_IN = [1, 21, 0] as const;

/** `a >= b`, comparing major, minor and patch in order. */
function atLeast(a: number[], b: readonly number[]): boolean {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return true;
}

describe("HTML a person wrote", () => {
    it("has module files to read", () => {
        expect(MODULE_FILES.length).toBeGreaterThan(200);
    });

    it("is not sanitised by each module for itself", () => {
        const offenders = MODULE_FILES.filter((file) =>
            /from "(?:isomorphic-)?dompurify"/.test(fs.readFileSync(file, "utf8")),
        ).map(rel);
        expect(offenders).toEqual([]);
    });

    it("is not written into the page by a module directly", () => {
        const offenders: string[] = [];
        for (const file of MODULE_FILES) {
            const source = fs.readFileSync(file, "utf8");
            for (const hit of source.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
                if (JSON_LD.test(hit[1])) continue;
                offenders.push(`${rel(file)}: ${hit[1].trim()}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("keeps no class from a typography plugin this project does not have", () => {
        // `prose`, and the `dark:` variant that never fires on a panel that
        // switches modes with [data-mode="dark"].
        const offenders: string[] = [];
        for (const file of MODULE_FILES) {
            // Comments are prose about prose: a note explaining why a column
            // of text is the width it is used to fail this.
            const source = fs.readFileSync(file, "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\/\/[^\n]*/g, "");
            if (/\bprose(?:-[a-z]+)?\b/.test(source)) offenders.push(`${rel(file)}: prose`);
            if (/\bdark:[a-z]/.test(source)) offenders.push(`${rel(file)}: dark:`);
        }
        expect(offenders).toEqual([]);
    });

    it("is styled by core, in the theme's colours", () => {
        const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
        expect(css).toContain(".uxw-content");
        for (const selector of ["h1", "ul", "ol", "blockquote", "code", "pre", "a", "table"]) {
            expect(css, `.uxw-content ${selector}`).toMatch(
                new RegExp(String.raw`\.uxw-content[^{]*\b${selector}\b[^{]*\{`),
            );
        }
        // Fixed colours here would be the same drift the panel gate keeps out.
        const block = css.slice(css.indexOf(".uxw-content"));
        const content = block.slice(0, block.indexOf("\n.text-gradient"));
        expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(/);
    });

    it("is reachable by a module", () => {
        const sdk = fs.readFileSync(path.join(ROOT, "src/core/sdk/ui.ts"), "utf8");
        expect(sdk).toContain("RichContent");
        const component = fs.readFileSync(path.join(ROOT, "src/core/components/ui/rich-content.tsx"), "utf8");
        expect(component).toContain('from "isomorphic-dompurify"');
        expect(component).toContain("DOMPurify.sanitize(html)");
        expect(component).toContain("uxw-content");
    });

    it("is required by every module that renders it", () => {
        // A module using an SDK symbol from 1.21.0 must ask for at least it.
        //
        // Asking for the floor rather than the exact string: this was written
        // as `toBe("^1.21.0")` against both core's own constant and every
        // module's range, which made the next unrelated addition to the SDK
        // fail this test. A module that later needs 1.22.0 still gets
        // RichContent, and pinning would have forced it to lie about that.
        const version = fs.readFileSync(path.join(ROOT, "src/core/lib/core-version.ts"), "utf8");
        const core = version.match(/CORE_API_VERSION = "(\d+)\.(\d+)\.(\d+)"/);
        expect(core, "core-version.ts must declare CORE_API_VERSION").toBeTruthy();
        expect(atLeast(core!.slice(1, 4).map(Number), INTRODUCED_IN)).toBe(true);

        const users = MODULE_FILES.filter((f) => /\bRichContent\b/.test(fs.readFileSync(f, "utf8")));
        expect(users.length).toBeGreaterThan(5);
        for (const file of users) {
            const id = path.relative(path.join(ROOT, "module-sources"), file).split(path.sep)[0];
            const manifest = JSON.parse(
                fs.readFileSync(path.join(ROOT, "module-sources", id, "module.json"), "utf8"),
            ) as { coreVersion: string };
            const asked = manifest.coreVersion.match(/\^(\d+)\.(\d+)\.(\d+)/);
            expect(asked, `${id} declares ${manifest.coreVersion}`).toBeTruthy();
            expect(atLeast(asked!.slice(1, 4).map(Number), INTRODUCED_IN), id).toBe(true);
            // Same major, or the caret range would not admit it at all.
            expect(asked![1], id).toBe(String(INTRODUCED_IN[0]));
        }
    });
});
