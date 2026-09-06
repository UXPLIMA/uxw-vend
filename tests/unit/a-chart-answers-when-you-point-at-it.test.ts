import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";

/**
 * Two things were wrong with the analytics screen.
 *
 * Hovering a chart produced nothing. Every dataset sets `pointRadius: 0`, and
 * Chart.js defaults to `intersect: true`, so a tooltip only fires when the
 * pointer lands on a point that is not drawn. The value at a given day - the
 * one thing a reader hovers a chart to learn - was unreachable.
 *
 * And every series was drawn as a filled line, whatever it was. A count of
 * orders on a day is a comparison between days, not a curve through them, and
 * a leaderboard has no time axis at all. Core owns the chart types and a
 * module picks one; a module cannot contribute a renderer, which is what keeps
 * the screen looking like one screen.
 */

const PAGE = "src/app/[locale]/(admin)/admin/analytics/page.tsx";
const src = readFileSync(PAGE, "utf8");

const modules = readdirSync("module-sources").filter((m) =>
    existsSync(`module-sources/${m}/api/stats/route.ts`),
);

/** The chart `type` values a module asks for, across every stats endpoint. */
function declaredChartTypes(): string[] {
    const out: string[] = [];
    for (const mod of modules) {
        const route = readFileSync(`module-sources/${mod}/api/stats/route.ts`, "utf8");
        for (const m of route.matchAll(/\btype:\s*"([a-z]+)"/g)) out.push(m[1]);
    }
    return out;
}

const SUPPORTED = new Set(["line", "area", "bar"]);

describe("a chart answers when you point at it", () => {
    it("reads the nearest column instead of an invisible point", () => {
        expect(src).toContain('interaction: { mode: "index" as const, intersect: false }');
        expect(src).toContain('hover: { mode: "index" as const, intersect: false }');
    });

    it("still labels the tooltip with the value and the series", () => {
        expect(src).toContain("callbacks:");
        expect(src).toContain("chart.format === \"currency\"");
    });

    it("renders every type it says it supports", () => {
        for (const kind of SUPPORTED) {
            expect(src, `${kind} is documented but not rendered`).toContain(`"${kind}"`);
        }
        expect(src).toContain("<Bar ");
        expect(src).toContain("<Line ");
    });

    it("registers the Chart.js elements those types need", () => {
        expect(src).toContain("BarElement");
        expect(src).toContain("LineElement");
        expect(src).toContain("PointElement");
        expect(src).toContain("Filler");
    });

    it("accepts only chart types core can draw", () => {
        const unsupported = declaredChartTypes().filter((kind) => !SUPPORTED.has(kind));
        expect(unsupported).toEqual([]);
    });

    it("gives a ranking its own panel rather than a time axis", () => {
        expect(src).toContain("RankingSeries");
        expect(src).toContain("body.rankings");
        // The proportional bar is what makes a list of numbers comparable.
        expect(src).toContain("item.value / peak");
    });

    it("does not leave the period filter as squares inside a rounded strip", () => {
        expect(src).not.toMatch(/rounded text-xs font-medium/);
        expect(src).toContain('rounded-full border border-border p-1 bg-card');
        expect(src).toContain("aria-pressed={period === p.key}");
    });
});
