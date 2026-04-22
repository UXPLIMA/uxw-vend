import { describe, it, expect } from "vitest";
import { CANONICAL_SLOTS, isCanonicalSlot } from "@/core/lib/slot-registry";

describe("canonical slot registry", () => {
    it("exposes at least the core slot names we depend on", () => {
        expect(CANONICAL_SLOTS.includes("layout.beforeMain")).toBe(true);
        expect(CANONICAL_SLOTS.includes("layout.afterMain")).toBe(true);
        expect(CANONICAL_SLOTS.includes("head.extra")).toBe(true);
    });

    it("isCanonicalSlot validates name format", () => {
        expect(isCanonicalSlot("layout.beforeMain")).toBe(true);
        expect(isCanonicalSlot("not a slot")).toBe(false);
    });
});
