import { describe, it, expect } from "vitest";
import {
    buildNavGroups,
    findActiveGroupId,
    findNavGroupConflicts,
    CORE_NAV_GROUPS,
    FALLBACK_NAV_GROUP_ID,
    type NavGroup,
} from "@/core/lib/admin-nav-groups";

const menuItem = (path: string, label: string, group?: string) => ({ path, label, group });

const allHrefs = (groups: NavGroup[]) =>
    groups.flatMap((g) => g.sections.flatMap((s) => s.items.map((i) => i.href)));

describe("buildNavGroups", () => {
    it("never returns a group with no items", () => {
        const groups = buildNavGroups({ modules: [] });
        expect(groups.length).toBeGreaterThan(0);
        for (const group of groups) {
            expect(group.sections.flatMap((s) => s.items).length).toBeGreaterThan(0);
        }
    });

    it("never returns an empty section", () => {
        const groups = buildNavGroups({ modules: [] });
        for (const group of groups) {
            for (const section of group.sections) {
                expect(section.items.length).toBeGreaterThan(0);
            }
        }
    });

    it("ships no core group that exists only for modules to fill", () => {
        // "commerce" was declared with sections: [] so modules could fill it,
        // which rendered an empty group on a zero-module install.
        expect(CORE_NAV_GROUPS.find((g) => g.id === "commerce")).toBeUndefined();
        for (const group of CORE_NAV_GROUPS) {
            expect(group.sections.flatMap((s) => s.items).length).toBeGreaterThan(0);
        }
    });

    it("creates the fallback bucket only once a module needs it", () => {
        expect(buildNavGroups({ modules: [] }).find((g) => g.id === FALLBACK_NAV_GROUP_ID)).toBeUndefined();

        const groups = buildNavGroups({ modules: [{ id: "vote", menu: [menuItem("/vote", "Vote")] }] });
        const fallback = groups.find((g) => g.id === FALLBACK_NAV_GROUP_ID);
        expect(fallback).toBeDefined();
        expect(allHrefs([fallback!])).toEqual(["/admin/vote"]);
    });

    it("keeps an item whose declared group nothing provides", () => {
        const groups = buildNavGroups({
            modules: [{ id: "store", menu: [menuItem("/store", "Store", "commerce")] }],
        });
        expect(allHrefs(groups)).toContain("/admin/store");
    });

    it("merges into a core group the module names", () => {
        const groups = buildNavGroups({
            modules: [{ id: "seo", menu: [menuItem("/seo", "SEO", "content")] }],
        });
        const content = groups.find((g) => g.id === "content")!;
        expect(allHrefs([content])).toContain("/admin/seo");
    });

    it("orders items independently of module input order", () => {
        const mods = [
            { id: "alpha", menu: [menuItem("/alpha", "Alpha")] },
            { id: "beta", menu: [menuItem("/beta", "Beta")] },
        ];
        const forward = allHrefs(buildNavGroups({ modules: mods }));
        const reversed = allHrefs(buildNavGroups({ modules: [...mods].reverse() }));
        expect(reversed).toEqual(forward);
    });

    it("gives a multi-item module its own labelled section", () => {
        const groups = buildNavGroups({
            modules: [{
                id: "store",
                menu: [menuItem("/store/products", "Products"), menuItem("/store/orders", "Orders")],
            }],
        });
        const fallback = groups.find((g) => g.id === FALLBACK_NAV_GROUP_ID)!;
        const section = fallback.sections.find((s) => s.items.length === 2)!;
        expect(section.header).toBeTruthy();
        expect(section.items.map((i) => i.href)).toEqual(["/admin/store/products", "/admin/store/orders"]);
    });

    it("pools single-item modules into one shared section", () => {
        const groups = buildNavGroups({
            modules: [
                { id: "vote", menu: [menuItem("/vote", "Vote")] },
                { id: "wheel", menu: [menuItem("/wheel", "Wheel")] },
            ],
        });
        const fallback = groups.find((g) => g.id === FALLBACK_NAV_GROUP_ID)!;
        expect(fallback.sections).toHaveLength(1);
        expect(fallback.sections[0].items).toHaveLength(2);
    });

    it("drops a module's contributions once it is no longer enabled", () => {
        // The caller passes only enabled modules, so a disabled module simply
        // stops appearing - and its group must go with it.
        const withModule = buildNavGroups({ modules: [{ id: "vote", menu: [menuItem("/vote", "Vote")] }] });
        expect(withModule.find((g) => g.id === FALLBACK_NAV_GROUP_ID)).toBeDefined();

        const withoutModule = buildNavGroups({ modules: [] });
        expect(withoutModule.find((g) => g.id === FALLBACK_NAV_GROUP_ID)).toBeUndefined();
    });

    it("appends a supplied theme group", () => {
        const themeGroup: NavGroup = {
            id: "theme",
            icon: CORE_NAV_GROUPS[0].icon,
            label: "Theme",
            sections: [{ items: [{ href: "/admin/theme/appearance", label: "Appearance" }] }],
        };
        const groups = buildNavGroups({ modules: [], themeGroup });
        expect(groups.find((g) => g.id === "theme")).toBeDefined();
    });

    it("uses the translate callback for module section headers", () => {
        const groups = buildNavGroups({
            modules: [{ id: "store", menu: [menuItem("/a", "A"), menuItem("/b", "B")] }],
            translate: (key, fallback) => (key === "menu_store" ? "Mağaza" : fallback),
        });
        const fallback = groups.find((g) => g.id === FALLBACK_NAV_GROUP_ID)!;
        expect(fallback.sections.some((s) => s.header === "Mağaza")).toBe(true);
    });
});

describe("findActiveGroupId", () => {
    it("resolves /admin to the dashboard group", () => {
        expect(findActiveGroupId("/admin", buildNavGroups({ modules: [] }))).toBe("dashboard");
    });

    it("resolves a module item to the group that holds it", () => {
        const groups = buildNavGroups({ modules: [{ id: "vote", menu: [menuItem("/vote", "Vote")] }] });
        expect(findActiveGroupId("/admin/vote", groups)).toBe(FALLBACK_NAV_GROUP_ID);
    });

    it("prefers the longest matching item href", () => {
        const groups = buildNavGroups({ modules: [] });
        expect(findActiveGroupId("/admin/settings/navbar", groups)).toBe("design");
    });
});

describe("module-declared nav groups", () => {
    const commerce = { id: "commerce", label: "Commerce", icon: "ShoppingBag", module: "store" };

    it("creates a declared group and fills it with the items that name it", () => {
        const groups = buildNavGroups({
            navGroups: [commerce],
            modules: [{ id: "store", menu: [menuItem("/store", "Store", "commerce")] }],
        });
        const group = groups.find((g) => g.id === "commerce");
        expect(group).toBeDefined();
        expect(group!.label).toBe("Commerce");
        expect(allHrefs([group!])).toEqual(["/admin/store"]);
    });

    it("does not create a declared group nothing contributes to", () => {
        const groups = buildNavGroups({ navGroups: [commerce], modules: [] });
        expect(groups.find((g) => g.id === "commerce")).toBeUndefined();
    });

    it("creates one group when two modules declare the same id", () => {
        const groups = buildNavGroups({
            navGroups: [
                { id: "commerce", label: "Commerce", module: "store" },
                { id: "commerce", label: "Shop", module: "credits" },
            ],
            modules: [
                { id: "store", menu: [menuItem("/store", "Store", "commerce")] },
                { id: "credits", menu: [menuItem("/credits", "Credits", "commerce")] },
            ],
        });
        expect(groups.filter((g) => g.id === "commerce")).toHaveLength(1);
        expect(allHrefs([groups.find((g) => g.id === "commerce")!]).sort())
            .toEqual(["/admin/credits", "/admin/store"]);
    });

    it("resolves a duplicate declaration by lexical module id, not input order", () => {
        const declarations = [
            { id: "commerce", label: "Shop", module: "store" },
            { id: "commerce", label: "Commerce", module: "credits" },
        ];
        const build = (navGroups: typeof declarations) =>
            buildNavGroups({
                navGroups,
                modules: [{ id: "store", menu: [menuItem("/store", "Store", "commerce")] }],
            }).find((g) => g.id === "commerce")!.label;

        // "credits" sorts before "store", so its label wins either way round.
        expect(build(declarations)).toBe("Commerce");
        expect(build([...declarations].reverse())).toBe("Commerce");
    });

    it("places module groups after the core groups", () => {
        const groups = buildNavGroups({
            navGroups: [commerce],
            modules: [{ id: "store", menu: [menuItem("/store", "Store", "commerce")] }],
        });
        const ids = groups.map((g) => g.id);
        expect(ids.indexOf("commerce")).toBeGreaterThan(ids.indexOf("dashboard"));
        expect(ids.indexOf("commerce")).toBeGreaterThan(ids.indexOf("settings"));
    });

    it("orders module groups by their declared order", () => {
        const groups = buildNavGroups({
            navGroups: [
                { id: "beta", label: "Beta", order: 20, module: "b-mod" },
                { id: "alpha", label: "Alpha", order: 10, module: "a-mod" },
            ],
            modules: [
                { id: "a-mod", menu: [menuItem("/a", "A", "alpha")] },
                { id: "b-mod", menu: [menuItem("/b", "B", "beta")] },
            ],
        });
        const ids = groups.map((g) => g.id);
        expect(ids.indexOf("alpha")).toBeLessThan(ids.indexOf("beta"));
    });
});

describe("findNavGroupConflicts", () => {
    it("is silent when two modules declare a group identically", () => {
        expect(findNavGroupConflicts([
            { id: "commerce", label: "Commerce", icon: "ShoppingBag", module: "store" },
            { id: "commerce", label: "Commerce", icon: "ShoppingBag", module: "credits" },
        ])).toEqual([]);
    });

    it("is silent for a single declaration", () => {
        expect(findNavGroupConflicts([{ id: "commerce", label: "Commerce", module: "store" }])).toEqual([]);
    });

    it("reports a label that disagrees with the winning declaration", () => {
        const conflicts = findNavGroupConflicts([
            { id: "commerce", label: "Commerce", module: "credits" },
            { id: "commerce", label: "Shop", module: "store" },
        ]);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].id).toBe("commerce");
        expect(conflicts[0].field).toBe("label");
        expect(conflicts[0].winner).toBe("credits");
        expect(conflicts[0].loser).toBe("store");
    });

    it("reports a disagreeing icon", () => {
        const conflicts = findNavGroupConflicts([
            { id: "commerce", label: "Commerce", icon: "ShoppingBag", module: "credits" },
            { id: "commerce", label: "Commerce", icon: "Coins", module: "store" },
        ]);
        expect(conflicts.map((c) => c.field)).toEqual(["icon"]);
    });
});
