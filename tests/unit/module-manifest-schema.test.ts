import { describe, it, expect } from "vitest";
import { moduleManifestSchema, collectManifestFileRefs } from "@/core/lib/module-manifest-schema";

const minimal = {
    id: "my-module",
    name: "My Module",
    description: "Test module",
    version: "1.0.0",
};

describe("moduleManifestSchema", () => {
    it("accepts a minimal manifest", () => {
        const parsed = moduleManifestSchema.safeParse(minimal);
        expect(parsed.success).toBe(true);
    });

    it("rejects invalid ids", () => {
        const bad = { ...minimal, id: "My-Module" };
        expect(moduleManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects non-semver versions", () => {
        const bad = { ...minimal, version: "not-semver" };
        expect(moduleManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects traversal in component paths", () => {
        const bad = {
            ...minimal,
            routes: [{ path: "/x", component: "../../../etc/passwd" }],
        };
        expect(moduleManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects absolute component paths", () => {
        const bad = {
            ...minimal,
            routes: [{ path: "/x", component: "/absolute/path.tsx" }],
        };
        expect(moduleManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("accepts deeply nested translations", () => {
        const deep = {
            ...minimal,
            translations: {
                en: {
                    store: {
                        title: "Store",
                        features: { fly: "Fly", repair: "Repair" },
                    },
                },
            },
        };
        expect(moduleManifestSchema.safeParse(deep).success).toBe(true);
    });

    it("strips unknown top-level keys (strict mode)", () => {
        const extra = { ...minimal, surprise: "nope" };
        expect(moduleManifestSchema.safeParse(extra).success).toBe(false);
    });

    it("accepts a module with slots contributions", () => {
        const m = {
            ...minimal,
            slots: [
                { name: "home.afterHero", component: "sections/Feature.tsx", order: 10 },
            ],
        };
        expect(moduleManifestSchema.safeParse(m).success).toBe(true);
    });

    it("rejects an invalid slot name", () => {
        const m = {
            ...minimal,
            slots: [{ name: "bad slot!!", component: "sections/X.tsx" }],
        };
        expect(moduleManifestSchema.safeParse(m).success).toBe(false);
    });
});

describe("collectManifestFileRefs", () => {
    it("returns empty array for minimal manifest", () => {
        const parsed = moduleManifestSchema.parse(minimal);
        expect(collectManifestFileRefs(parsed)).toEqual([]);
    });

    it("collects unique component and handler paths", () => {
        const manifest = moduleManifestSchema.parse({
            ...minimal,
            routes: [
                { path: "/a", component: "pages/a.tsx" },
                { path: "/b", component: "pages/b.tsx" },
            ],
            api: [{ path: "/api/a", handler: "api/a.ts" }],
            widgets: [
                { id: "w1", component: "widgets/w1.tsx", defaultOrder: 1, defaultVisible: true },
            ],
            hooks: { onEnable: "hooks/enable.ts" },
        });

        const refs = collectManifestFileRefs(manifest);
        expect(refs).toContain("pages/a.tsx");
        expect(refs).toContain("pages/b.tsx");
        expect(refs).toContain("api/a.ts");
        expect(refs).toContain("widgets/w1.tsx");
        expect(refs).toContain("hooks/enable.ts");
        expect(new Set(refs).size).toBe(refs.length);
    });
});
