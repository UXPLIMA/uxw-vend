import { describe, it, expect } from "vitest";
import { adminHref } from "@/core/lib/admin-path";

describe("adminHref", () => {
    it("prefixes a panel-relative path", () => {
        expect(adminHref("/vote-sites")).toBe("/admin/vote-sites");
        expect(adminHref("/settings/discord-auth")).toBe("/admin/settings/discord-auth");
    });

    it("leaves an already-absolute admin path alone", () => {
        // ModuleRoutes stores the finished path; prefixing it again produced
        // /admin/admin/vote-sites in the spotlight.
        expect(adminHref("/admin/vote-sites")).toBe("/admin/vote-sites");
        expect(adminHref("/admin")).toBe("/admin");
    });

    it("is idempotent", () => {
        expect(adminHref(adminHref("/currency"))).toBe("/admin/currency");
    });

    it("accepts a path written without its leading slash", () => {
        expect(adminHref("vote-sites")).toBe("/admin/vote-sites");
    });

    it("does not mistake a path that merely starts with the word admin", () => {
        expect(adminHref("/administrators")).toBe("/admin/administrators");
    });

    it("falls back to the panel root for an empty path", () => {
        expect(adminHref("")).toBe("/admin");
        expect(adminHref("  ")).toBe("/admin");
        expect(adminHref("/")).toBe("/admin");
    });
});
