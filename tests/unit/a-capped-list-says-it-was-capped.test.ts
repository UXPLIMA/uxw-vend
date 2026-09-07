import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A list that stopped at its ceiling says so.
 *
 * Three endpoints stop at 500 rows, because the tables behind them fill up
 * while the site is used: every API key anyone ever made, every coupon the
 * shop ever ran, every staff application ever sent. Each fetches one row past
 * the ceiling so it can answer `truncated: true` rather than look complete.
 *
 * That was only half the job. The screens rendered the array and ignored the
 * flag, so an operator on a large install saw five hundred rows and no reason
 * to think there were more, which is the same silence the ceiling was added
 * to avoid.
 *
 * The pairs below are the whole rule: an endpoint that can cap its answer has
 * a screen that reads the flag. Adding a fourth capped endpoint should mean
 * adding a line here and a sentence to a screen.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

const CAPPED: { endpoint: string; screen: string }[] = [
    {
        endpoint: "src/app/api/v1/api-keys/route.ts",
        screen: "src/app/[locale]/(admin)/admin/api-keys/page.tsx",
    },
    {
        endpoint: "module-sources/store/api/coupons/route.ts",
        screen: "module-sources/store/pages/admin/coupons/page.tsx",
    },
    {
        endpoint: "module-sources/staff/api/applications/route.ts",
        screen: "module-sources/staff/pages/admin/applications/page.tsx",
    },
];

describe("a list that stops at its ceiling", () => {
    it("is capped by the endpoint that serves it", () => {
        for (const { endpoint } of CAPPED) {
            const source = fs.readFileSync(path.join(ROOT, endpoint), "utf8");
            expect(source, `${endpoint} should cap its answer`).toContain("MAX_ROWS");
            expect(source, `${endpoint} should say when it did`).toContain("truncated");
        }
    });

    it("is read by the screen that shows it", () => {
        const silent = CAPPED.filter(({ screen }) => {
            const full = path.join(ROOT, screen);
            expect(fs.existsSync(full), `${screen} should exist`).toBe(true);
            return !fs.readFileSync(full, "utf8").includes("truncated");
        }).map(({ screen }) => screen);

        expect(
            silent,
            `these show a list their endpoint may have cut short, without saying so:\n${silent.join("\n")}`,
        ).toEqual([]);
    });
});
