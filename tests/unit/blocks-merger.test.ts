import { describe, it, expect, vi } from "vitest";

// Mock the generated module-blocks file before importing the merger
vi.mock("@/core/generated/module-blocks", () => ({
    ModulePageBlocks: [
        {
            id: "TestBlock",
            category: "test",
            component: "blocks/Test",
            module: "test-mod",
            loader: () => Promise.resolve({
                default: {
                    fields: { text: { type: "text" as const } },
                    defaultProps: { text: "hello" },
                    render: ({ text }: { text: string }) => text,
                },
            }),
        },
        {
            id: "AnotherBlock",
            category: "test",
            component: "blocks/Another",
            module: "another-mod",
            loader: () => Promise.resolve({
                default: {
                    fields: {},
                    defaultProps: {},
                    render: () => null,
                },
            }),
        },
    ],
}));

import { buildMergedBlockConfig } from "@/core/lib/blocks-merger";

/** Everything on, which is what an install with no ModuleConfig rows looks like. */
const ALL_ON = {};

describe("blocks-merger", () => {
    it("merges core + module blocks into a single config", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: ALL_ON, mode: "edit" });

        // Core blocks present
        expect(merged.components).toHaveProperty("Hero");
        expect(merged.components).toHaveProperty("Heading");
        // Module blocks added
        expect(merged.components).toHaveProperty("TestBlock");
        expect(merged.components).toHaveProperty("AnotherBlock");
    });

    it("creates a category for module blocks if not in core", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: ALL_ON, mode: "edit" });
        expect(merged.categories).toHaveProperty("test");
        expect(merged.categories?.test.components).toContain("TestBlock");
        expect(merged.categories?.test.components).toContain("AnotherBlock");
    });

    it("preserves core categories", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: ALL_ON, mode: "render" });
        expect(merged.categories).toHaveProperty("layout");
        expect(merged.categories).toHaveProperty("content");
    });
});

/**
 * A block from a module the admin switched off.
 *
 * Every other module capability filters on `isEnabledIn` - slots, homepage
 * widgets and sections, dashboard cards, nav links - and the proxy answers
 * 404 for a disabled module's pages and API routes. Page blocks did not, so a
 * custom page carrying a disabled module's block still mounted it, the fetch
 * inside it came back 404, and the visitor got a silent empty region. The
 * builder went on offering the block in its palette.
 */
describe("a disabled module's blocks", () => {
    const OFF = { "test-mod": false };

    it("are gone from a config meant for rendering", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: OFF, mode: "render" });
        expect(merged.components).not.toHaveProperty("TestBlock");
        expect(merged.components).toHaveProperty("AnotherBlock");
    });

    it("stay loadable in the editor so a page already using one still opens", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: OFF, mode: "edit" });
        expect(merged.components).toHaveProperty("TestBlock");
    });

    it("are not offered in the editor's palette", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: OFF, mode: "edit" });
        expect(merged.categories?.test.components).not.toContain("TestBlock");
        expect(merged.categories?.test.components).toContain("AnotherBlock");
    });

    it("leave no empty category heading behind", async () => {
        const bothOff = { "test-mod": false, "another-mod": false };
        for (const mode of ["edit", "render"] as const) {
            const merged = await buildMergedBlockConfig({ moduleStates: bothOff, mode });
            expect(merged.categories).not.toHaveProperty("test");
            // Core's own categories are untouched.
            expect(merged.categories).toHaveProperty("layout");
        }
    });

    it("counts an absent entry as enabled, the way isEnabledIn does", async () => {
        const merged = await buildMergedBlockConfig({ moduleStates: { "other": false }, mode: "render" });
        expect(merged.components).toHaveProperty("TestBlock");
        expect(merged.categories?.test.components).toContain("TestBlock");
    });
});
