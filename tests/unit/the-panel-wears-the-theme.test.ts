/**
 * The admin panel is painted in the theme's colours, not Tailwind's.
 *
 * `bg-green-100 text-green-700` is a light chip with dark green text on it,
 * always, whoever is looking and whatever theme is installed. The panel
 * switches to dark on `[data-mode="dark"]` at the root - not on Tailwind's
 * `dark:` variant, which follows the operating system - so those chips stayed
 * bright on a dark panel, and the `dark:bg-green-950` some of them carried
 * never fired at all. A theme that recoloured the whole admin could not touch
 * any of them either.
 *
 * Every one of them is a token now: `bg-success/10 text-success`, and the
 * tokens are redefined per mode and per theme. This keeps the palette out.
 *
 * Scope is the admin: the panel is core's own surface and follows the site's
 * theme. A public theme under src/themes IS a design and names whatever
 * colours it likes.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../..");

const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const FIXED = new RegExp(String.raw`\b(?:bg|text|border|ring|from|to|via)-(?:${PALETTE})-\d{2,3}\b`, "g");
/** Tailwind's own dark variant, which this project does not switch on. */
const OS_DARK = /\bdark:[a-z-]+\b/g;

function adminRoots(): string[] {
    const roots = [
        join(ROOT, "src/app/[locale]/(admin)"),
        join(ROOT, "src/core/components/admin"),
        join(ROOT, "src/core/components/ui"),
    ];
    const sources = join(ROOT, "module-sources");
    if (existsSync(sources)) {
        for (const entry of readdirSync(sources)) {
            const pages = join(sources, entry, "pages/admin");
            if (existsSync(pages)) roots.push(pages);
        }
    }
    return roots.filter((r) => existsSync(r));
}

function tsxFiles(dir: string, into: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) tsxFiles(full, into);
        else if (entry.endsWith(".tsx")) into.push(full);
    }
    return into;
}

/** Class names only. A doc comment may name the class it replaced. */
function classAttributes(source: string): string {
    return source
        .split("\n")
        .filter((line) => !/^\s*(?:\*|\/\/|\/\*)/.test(line))
        .join("\n");
}

describe("the admin panel", () => {
    const files = adminRoots().flatMap((r) => tsxFiles(r));

    it("has screens to check", () => {
        expect(files.length).toBeGreaterThan(80);
    });

    it("names no fixed colour from Tailwind's palette", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const hits = classAttributes(readFileSync(file, "utf-8")).match(FIXED);
            if (hits) offenders.push(`${file.slice(ROOT.length + 1)}: ${[...new Set(hits)].join(", ")}`);
        }
        expect(offenders).toEqual([]);
    });

    it("does not reach for the `dark:` variant, which never fires here", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const hits = classAttributes(readFileSync(file, "utf-8")).match(OS_DARK);
            if (hits) offenders.push(`${file.slice(ROOT.length + 1)}: ${[...new Set(hits)].join(", ")}`);
        }
        expect(offenders).toEqual([]);
    });
});
