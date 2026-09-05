import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { CORE_WIDGETS, moduleWidgetId } from "@/core/lib/dashboard-layout";

/**
 * "Customize dashboard" offered a list of widgets, saved the answer and
 * reloaded the page. The page then consulted that answer for its five core
 * widgets only: `<ModuleStatCards />` rendered every module card regardless,
 * and `<ModuleSections />` every module panel, so unchecking Revenue, Orders
 * or Products did nothing an admin could see. The KPI row was also wrapped in
 * `{(visibleKpiWidgets.length > 0 || true) && ...}`, which is `true`.
 *
 * A control that does nothing is worse than a missing one: it teaches an
 * operator that the panel lies. So the invariant is: what the customizer
 * lists, the dashboard obeys, and what the dashboard renders, the customizer
 * could have listed.
 */

const DASHBOARD_PAGE = "src/app/[locale]/(admin)/admin/page.tsx";
const DASHBOARD_CLIENT = "src/app/[locale]/(admin)/admin/components/dashboard-client.tsx";

function catalogue(locale: string): Record<string, string> {
    const raw = JSON.parse(readFileSync(`messages-core/${locale}.json`, "utf8"));
    const out: Record<string, string> = {};
    for (const value of Object.values(raw)) {
        if (value && typeof value === "object") Object.assign(out, value);
    }
    return out;
}

/** Section ids a module's stats endpoint actually returns. */
function returnedSectionIds(moduleId: string): string[] {
    const route = `module-sources/${moduleId}/api/stats/route.ts`;
    if (!existsSync(route)) return [];
    const src = readFileSync(route, "utf8");
    return [...src.matchAll(/id:\s*"([\w-]+)",\s*\n?\s*title:/g)].map((m) => m[1]);
}

const modules = readdirSync("module-sources").filter((m) =>
    existsSync(`module-sources/${m}/module.json`),
);

describe("the customizer governs what it lists", () => {
    it("names every core widget with a key the catalogues carry", () => {
        const en = catalogue("en");
        const tr = catalogue("tr");
        for (const widget of CORE_WIDGETS) {
            expect(widget.labelKey, `${widget.id} has no labelKey`).toBeTruthy();
            expect(en[widget.labelKey!], `en is missing ${widget.labelKey}`).toBeTruthy();
            expect(tr[widget.labelKey!], `tr is missing ${widget.labelKey}`).toBeTruthy();
            expect(widget.descriptionKey, `${widget.id} has no descriptionKey`).toBeTruthy();
            expect(en[widget.descriptionKey!], `en is missing ${widget.descriptionKey}`).toBeTruthy();
            expect(tr[widget.descriptionKey!], `tr is missing ${widget.descriptionKey}`).toBeTruthy();
        }
    });

    it("has a component behind every core widget it offers", () => {
        const page = readFileSync(DASHBOARD_PAGE, "utf8");
        for (const widget of CORE_WIDGETS) {
            expect(page, `${widget.id} is offered but never rendered`).toContain(`"${widget.id}":`);
        }
    });

    it("renders the KPI row from the saved order, not unconditionally", () => {
        const page = readFileSync(DASHBOARD_PAGE, "utf8");
        expect(page).not.toContain("|| true");
        expect(page).toContain("<DashboardKpiRow");
        expect(page).toContain("coreSlots={coreSlots}");
    });

    it("passes the hidden panels down to the section renderer", () => {
        const page = readFileSync(DASHBOARD_PAGE, "utf8");
        expect(page).toContain("<ModuleSections hidden={hiddenSections} />");
        const client = readFileSync(DASHBOARD_CLIENT, "utf8");
        expect(client).toContain("hiddenIds.has(section.id)");
    });

    it("declares in the manifest every section panel a module returns", () => {
        const undeclared: string[] = [];
        for (const mod of modules) {
            const returned = returnedSectionIds(mod);
            if (returned.length === 0) continue;
            const manifest = JSON.parse(
                readFileSync(`module-sources/${mod}/module.json`, "utf8"),
            ) as { dashboardSections?: { id: string }[] };
            const declared = new Set((manifest.dashboardSections ?? []).map((s) => s.id));
            for (const id of returned) {
                if (!declared.has(id)) undeclared.push(`${mod}:${id}`);
            }
        }
        expect(undeclared).toEqual([]);
    });

    it("agrees with the client on how a module widget id is spelled", () => {
        expect(moduleWidgetId("card", "store", "revenue")).toBe("mod:store:revenue");
        expect(moduleWidgetId("section", "store", "recent-orders")).toBe(
            "mod:store:section:recent-orders",
        );
        const client = readFileSync(DASHBOARD_CLIENT, "utf8");
        expect(client).toContain('`mod:${moduleId}:section:${id}`');
        expect(client).toContain('`mod:${moduleId}:${id}`');
    });
});
