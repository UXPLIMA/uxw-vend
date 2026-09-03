import { describe, it, expect } from "vitest";
import { toIconSlug, iconLabel, searchIconNames } from "@/core/lib/icon-names";

describe("toIconSlug", () => {
    it("converts PascalCase to kebab-case", () => {
        expect(toIconSlug("ShoppingBag")).toBe("shopping-bag");
        expect(toIconSlug("Gamepad2")).toBe("gamepad2");
    });

    it("splits runs of capitals before a word", () => {
        expect(toIconSlug("QRCode")).toBe("qr-code");
    });

    it("leaves a kebab-case name alone", () => {
        expect(toIconSlug("shopping-bag")).toBe("shopping-bag");
    });

    it("normalises spaces and underscores an admin may type", () => {
        expect(toIconSlug("  shopping bag ")).toBe("shopping-bag");
        expect(toIconSlug("shopping_bag")).toBe("shopping-bag");
    });
});

describe("iconLabel", () => {
    it("title-cases each word", () => {
        expect(iconLabel("shopping-bag")).toBe("Shopping Bag");
        expect(iconLabel("ShoppingBag")).toBe("Shopping Bag");
    });

    it("survives a name with no separators", () => {
        expect(iconLabel("home")).toBe("Home");
    });
});

describe("searchIconNames", () => {
    const names = ["bar-chart", "bar-chart-3", "bar", "chart-line", "home", "shopping-bag", "sidebar"];

    it("returns every name for an empty query", () => {
        expect(searchIconNames(names, "")).toEqual(names);
        expect(searchIconNames(names, "   ")).toEqual(names);
    });

    it("ranks an exact match first, then prefixes", () => {
        expect(searchIconNames(names, "bar").slice(0, 3)).toEqual(["bar", "bar-chart", "bar-chart-3"]);
    });

    it("ranks a word start ahead of a mid-word match", () => {
        expect(searchIconNames(names, "bar").at(-1)).toBe("sidebar");
    });

    it("drops names that do not match at all", () => {
        expect(searchIconNames(names, "chart")).toEqual(["chart-line", "bar-chart", "bar-chart-3"]);
        expect(searchIconNames(names, "zzz")).toEqual([]);
    });

    it("accepts the PascalCase spelling of a name", () => {
        expect(searchIconNames(names, "ShoppingBag")).toEqual(["shopping-bag"]);
    });

    it("does not mutate the list it was given", () => {
        const original = [...names];
        searchIconNames(names, "bar");
        expect(names).toEqual(original);
    });
});
