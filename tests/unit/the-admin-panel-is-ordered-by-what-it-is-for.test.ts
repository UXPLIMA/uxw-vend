/**
 * The admin panel is arranged by the job, not by where the code lives.
 *
 * Measured on 2026-09-11 with 89 modules installed. Two things made it hard
 * to find anything.
 *
 * A group a module declares was pushed past every group core ships, so
 * Commerce, Community and Gaming - the screens an operator opens daily - sat
 * below Advanced and Settings, which they open twice a year.
 *
 * And a module with a single admin page had nowhere to say where it belonged,
 * so it fell into a pooled drawer called "Extensions". Under Settings that
 * drawer held eighteen entries, fourteen of them payment providers, while the
 * page that configures payment itself was in Commerce. The drawer is fine for
 * two or three odds and ends; it is not a place to keep a category.
 *
 * So a group declares where it sits, and a menu entry can name the section it
 * belongs to. Core still names no module: it declares its own order and
 * leaves the numbers between its groups free.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildNavGroups, CORE_NAV_GROUPS } from "@/core/lib/admin-nav-groups";

const ROOT = process.cwd();

/** Two core groups with room between them, the way core declares its own. */
const CORE = [
    { id: "first", icon: CORE_NAV_GROUPS[0].icon, label: "First", order: 10, sections: [{ items: [{ href: "/admin/a", label: "A", icon: CORE_NAV_GROUPS[0].icon }] }] },
    { id: "last", icon: CORE_NAV_GROUPS[0].icon, label: "Last", order: 90, sections: [{ items: [{ href: "/admin/z", label: "Z", icon: CORE_NAV_GROUPS[0].icon }] }] },
];

function ids(groups: ReturnType<typeof buildNavGroups>) {
    return groups.map((g) => g.id);
}

function sectionHeaders(groups: ReturnType<typeof buildNavGroups>, groupId: string) {
    return groups.find((g) => g.id === groupId)?.sections.map((s) => s.header) ?? [];
}

describe("where a group sits", () => {
    it("is what the group declares, even when a module declares it", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [{ id: "shop", menu: [{ path: "/shop", label: "Shop", group: "middle" }] }],
            navGroups: [{ module: "shop", id: "middle", label: "Middle", order: 50 }],
        });
        expect(ids(groups)).toEqual(["first", "middle", "last"]);
    });

    it("is the end of the panel when nothing says otherwise", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [{ id: "shop", menu: [{ path: "/shop", label: "Shop", group: "late" }] }],
            navGroups: [{ module: "shop", id: "late", label: "Late" }],
        });
        expect(ids(groups)).toEqual(["first", "last", "late"]);
    });
});

describe("where a single-page module sits inside its group", () => {
    it("is the section it names", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [{ id: "acme-pay", menu: [{ path: "/acme", label: "Acme", group: "first", section: "payments" }] }],
        });
        expect(sectionHeaders(groups, "first")).toContain("payments");
    });

    it("is shared with every other module naming the same section", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [
                { id: "acme-pay", menu: [{ path: "/acme", label: "Acme", group: "first", section: "payments" }] },
                { id: "zeta-pay", menu: [{ path: "/zeta", label: "Zeta", group: "first", section: "payments" }] },
            ],
        });
        const payments = groups.find((g) => g.id === "first")?.sections.filter((s) => s.header === "payments") ?? [];
        expect(payments).toHaveLength(1);
        expect(payments[0].items.map((i) => i.label)).toEqual(["Acme", "Zeta"]);
    });

    it("is the pooled drawer only when it names nothing", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [{ id: "odd", menu: [{ path: "/odd", label: "Odd", group: "first" }] }],
        });
        expect(sectionHeaders(groups, "first")).toContain("Extensions");
    });

    it("leaves the drawer last, after the sections that were named", () => {
        const groups = buildNavGroups({
            coreGroups: CORE,
            modules: [
                { id: "acme-pay", menu: [{ path: "/acme", label: "Acme", group: "first", section: "payments" }] },
                { id: "aaa-odd", menu: [{ path: "/odd", label: "Odd", group: "first" }] },
            ],
        });
        const headers = sectionHeaders(groups, "first");
        expect(headers.indexOf("Extensions")).toBe(headers.length - 1);
    });
});

describe("the panel this repository actually ships", () => {
    const manifests = fs.readdirSync(path.join(ROOT, "module-sources"))
        .map((id) => path.join("module-sources", id, "module.json"))
        .filter((p) => fs.existsSync(path.join(ROOT, p)))
        .map((p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")));

    const built = buildNavGroups({
        modules: manifests.map((m) => ({ id: m.id, menu: m.menu })),
        navGroups: manifests.flatMap((m) => (m.navGroups ?? []).map((g: Record<string, unknown>) => ({ ...g, module: m.id }))),
    });

    it("keeps no drawer big enough to be a category", () => {
        const oversized: string[] = [];
        for (const group of built) {
            for (const section of group.sections) {
                if (section.headerKey === "sidebar_extensions" && section.items.length > 6) {
                    oversized.push(`${group.id}: ${section.items.length} items`);
                }
            }
        }
        expect(oversized).toEqual([]);
    });

    it("puts the work an operator does daily above the work they do twice a year", () => {
        const order = built.map((g) => g.id);
        const daily = ["commerce", "community"];
        for (const id of daily) {
            expect(order.indexOf(id), id).toBeGreaterThan(-1);
            expect(order.indexOf(id), `${id} is below settings`).toBeLessThan(order.indexOf("settings"));
            expect(order.indexOf(id), `${id} is below system`).toBeLessThan(order.indexOf("system"));
        }
    });

    it("names every group once, so the rail has no two doors to one room", () => {
        const ids = built.map((g) => g.id);
        expect(ids).toEqual([...new Set(ids)]);
    });
});
