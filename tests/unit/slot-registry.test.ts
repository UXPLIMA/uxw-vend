import { describe, it, expect } from "vitest";
import { CANONICAL_SLOTS, isCanonicalSlot } from "@/core/lib/slot-registry";

describe("canonical slot registry", () => {
    it("exposes at least the core slot names we depend on", () => {
        expect(CANONICAL_SLOTS.includes("home.beforeHero")).toBe(true);
        expect(CANONICAL_SLOTS.includes("home.afterHero")).toBe(true);
        expect(CANONICAL_SLOTS.includes("navbar.right")).toBe(true);
        expect(CANONICAL_SLOTS.includes("footer.extra")).toBe(true);
    });

    it("isCanonicalSlot validates name format", () => {
        expect(isCanonicalSlot("home.afterHero")).toBe(true);
        expect(isCanonicalSlot("not a slot")).toBe(false);
    });
});
