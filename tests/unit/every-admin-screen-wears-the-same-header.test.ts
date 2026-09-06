import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";

/**
 * One title row, one set of proportions.
 *
 * Eighty admin screens had written their own. The heading came in twelve
 * sizes: `text-3xl font-bold` on fifty-one, `text-xl font-semibold` on
 * twenty-five, `text-lg font-medium` on one. The row was `items-center mb-8`
 * here and `items-start mb-6` there, so the action button beside the title
 * sat at a different height and a different distance from the table below.
 * The way back out of a create form was a top-right outline button on one
 * screen, an icon-only ghost button on another, and a bare `← Back to
 * Articles` link - in English, on a Turkish page - on a third.
 *
 * `AdminPageHeader` is the row. These are the two rules that keep it one.
 *
 * A screen that is not a page - the page builder's fixed toolbar, an error
 * card - is not covered here, and does not pretend to be a page header.
 */

const ROOT = join(__dirname, "..", "..");

const ADMIN_TREES = [
    "src/app/[locale]/(admin)",
    "src/core/components/admin",
    ...listModuleAdminDirs(),
];

function listModuleAdminDirs(): string[] {
    try {
        return execFileSync("sh", ["-c", "ls -d module-sources/*/pages/admin 2>/dev/null"], {
            cwd: ROOT,
            encoding: "utf8",
        })
            .split("\n")
            .filter(Boolean);
    } catch {
        return [];
    }
}

function grep(pattern: string, paths: string[]): string[] {
    if (paths.length === 0) return [];
    try {
        return execFileSync("grep", ["-rn", "--include=*.tsx", pattern, ...paths], {
            cwd: ROOT,
            encoding: "utf8",
        })
            .split("\n")
            .filter(Boolean);
    } catch {
        return [];
    }
}

/** Screens that are deliberately not a page with a title row. */
const NOT_A_PAGE = [
    // The header itself.
    "src/core/components/admin/AdminPageHeader.tsx",
    // A full-screen editor with a fixed toolbar, not a scrolling page.
    "module-sources/custom-pages/pages/admin/builder/",
    // The admin error boundary: a card in the middle of the screen.
    "src/app/[locale]/(admin)/error.tsx",
];

describe("every admin screen wears the same header", () => {
    it("leaves the page title to AdminPageHeader", () => {
        const offenders = grep("<h1", ADMIN_TREES).filter(
            (line) => !NOT_A_PAGE.some((allowed) => line.startsWith(allowed)),
        );
        expect(offenders).toEqual([]);
    });

    it("puts no icon in the title", () => {
        // Two screens out of eighty drew a lucide icon to the left of their
        // title. On every other screen the title is words, so the two with a
        // glyph read as a different kind of page for no reason - and the
        // theme screen's palette icon sat at a size nothing else used.
        const offenders: string[] = [];
        for (const line of grep("title={<>", ADMIN_TREES)) {
            const [file] = line.split(":");
            const src = fs.readFileSync(join(ROOT, file), "utf8");
            const start = src.indexOf("title={<>");
            const end = src.indexOf("</>}", start);
            if (start === -1 || end === -1) continue;
            const title = src.slice(start, end);
            // A lucide icon is `<Name className="w-4 h-4" />`: an element
            // whose name is capitalised and that sizes itself in w-/h-.
            if (/<[A-Z]\w*\s[^>]*className="[^"]*\bw-\d/.test(title)) offenders.push(`${file}: ${title.split("\n")[1]?.trim()}`);
        }
        expect(offenders, "a title is words; put the icon in the sidebar entry").toEqual([]);
    });

    it("keeps the way back with the actions, not on a line of its own", () => {
        const header = fs.readFileSync(join(ROOT, "src/core/components/admin/AdminPageHeader.tsx"), "utf8");
        // The back control used to be rendered above the title row, which
        // pushed the heading down the page and left the whole top right
        // corner of a create form empty.
        const row = header.slice(header.indexOf("return ("));
        const cluster = row.indexOf("{back}");
        const heading = row.indexOf("<h1");
        expect(cluster, "back belongs in the right hand cluster").toBeGreaterThan(heading);
        expect(row).toContain("items-center");
    });

    it("is mounted widely enough for that to mean something", () => {
        expect(grep("<AdminPageHeader", ADMIN_TREES).length).toBeGreaterThan(60);
    });
});
