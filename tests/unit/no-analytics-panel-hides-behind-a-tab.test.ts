/**
 * Splitting the analytics screen into tabs without losing anything behind one.
 *
 * The screen was one scroll of every chart every installed module offered, in
 * whatever order the fetches came back. With a shop, a forum, a credit ledger
 * and a support desk installed that is a wall, and the four reports an
 * operator actually opens it for are somewhere in the middle of it.
 *
 * Tabs are the fix, and they are the module's to name: core owns no report
 * headings, because "payment methods" and "categories" are a shop's words and
 * core does not know a shop exists. A module declares the groups it fills and
 * tags each chart with one.
 *
 * Which makes this the thing to defend. A filter is one typo from being a
 * shredder: a chart tagged with a group nobody declared, or a module that
 * declares a tab and then names it slightly differently on a chart, must not
 * disappear. Everything is reachable from the first tab, always, and that tab
 * is core's own - the one heading core is entitled to write.
 */
import { describe, it, expect } from "vitest";
import { ALL_TAB, analyticsTabs } from "@/core/lib/analytics-tabs";

const chart = (id: string, group?: string) => ({ id, group });
const ranking = (id: string, group?: string) => ({ id, group });

describe("with no module declaring a group", () => {
    it("is one tab holding everything", () => {
        const tabs = analyticsTabs([], [chart("a"), chart("b")], [ranking("r")]);
        expect(tabs).toHaveLength(1);
        expect(tabs[0].id).toBe(ALL_TAB);
        expect(tabs[0].charts.map((c) => c.id)).toEqual(["a", "b"]);
        expect(tabs[0].rankings.map((r) => r.id)).toEqual(["r"]);
    });
});

describe("with groups declared", () => {
    const declared = [
        { id: "monthly", label: "By month", labelKey: "store_byMonth" },
        { id: "payments", label: "By payment method" },
    ];

    it("puts the everything tab first, whatever the modules ordered", () => {
        const tabs = analyticsTabs(declared, [chart("a", "payments"), chart("b", "monthly")], []);
        expect(tabs[0].id).toBe(ALL_TAB);
        expect(tabs.map((tab) => tab.id)).toEqual([ALL_TAB, "monthly", "payments"]);
    });

    it("carries the module's own words for its tab", () => {
        const tabs = analyticsTabs(declared, [chart("a", "monthly")], []);
        const monthly = tabs.find((tab) => tab.id === "monthly");
        expect(monthly?.label).toBe("By month");
        expect(monthly?.labelKey).toBe("store_byMonth");
    });

    it("keeps a declared order rather than the order the fetches returned", () => {
        const ordered = [
            { id: "second", label: "Second", order: 2 },
            { id: "first", label: "First", order: 1 },
        ];
        const tabs = analyticsTabs(ordered, [chart("a", "second"), chart("b", "first")], []);
        expect(tabs.map((tab) => tab.id)).toEqual([ALL_TAB, "first", "second"]);
    });

    it("drops a tab nothing fills, because an empty tab says nothing", () => {
        const tabs = analyticsTabs(declared, [chart("a", "monthly")], []);
        expect(tabs.map((tab) => tab.id)).toEqual([ALL_TAB, "monthly"]);
    });

    it("sends a panel to its own tab and to the everything tab, not one or the other", () => {
        const tabs = analyticsTabs(declared, [chart("a", "monthly")], [ranking("r", "payments")]);
        expect(tabs[0].charts.map((c) => c.id)).toEqual(["a"]);
        expect(tabs[0].rankings.map((r) => r.id)).toEqual(["r"]);
        expect(tabs.find((tab) => tab.id === "monthly")?.charts.map((c) => c.id)).toEqual(["a"]);
        expect(tabs.find((tab) => tab.id === "payments")?.rankings.map((r) => r.id)).toEqual(["r"]);
    });

    it("keeps a panel whose group nobody declared, in the everything tab", () => {
        const tabs = analyticsTabs(declared, [chart("a", "typo"), chart("b", "monthly")], []);
        expect(tabs[0].charts.map((c) => c.id)).toEqual(["a", "b"]);
        expect(tabs.map((tab) => tab.id)).toEqual([ALL_TAB, "monthly"]);
    });

    it("keeps an untagged panel in the everything tab", () => {
        const tabs = analyticsTabs(declared, [chart("a"), chart("b", "monthly")], []);
        expect(tabs[0].charts.map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("merges two modules declaring the same group, first naming wins", () => {
        const twice = [
            { id: "monthly", label: "By month" },
            { id: "monthly", label: "Monthly totals" },
        ];
        const tabs = analyticsTabs(twice, [chart("a", "monthly"), chart("b", "monthly")], []);
        expect(tabs).toHaveLength(2);
        expect(tabs[1].label).toBe("By month");
        expect(tabs[1].charts.map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("refuses a module trying to redeclare the everything tab", () => {
        const tabs = analyticsTabs(
            [{ id: ALL_TAB, label: "Mine now" }],
            [chart("a", ALL_TAB)],
            [],
        );
        expect(tabs).toHaveLength(1);
        expect(tabs[0].id).toBe(ALL_TAB);
        expect(tabs[0].label).toBeNull();
        expect(tabs[0].charts.map((c) => c.id)).toEqual(["a"]);
    });
});
