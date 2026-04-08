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

describe("blocks-merger", () => {
    it("merges core + module blocks into a single config", async () => {
        const merged = await buildMergedBlockConfig();

        // Core blocks present
        expect(merged.components).toHaveProperty("Hero");
        expect(merged.components).toHaveProperty("Heading");
        // Module blocks added
        expect(merged.components).toHaveProperty("TestBlock");
        expect(merged.components).toHaveProperty("AnotherBlock");
    });

    it("creates a category for module blocks if not in core", async () => {
        const merged = await buildMergedBlockConfig();
        expect(merged.categories).toHaveProperty("test");
        expect(merged.categories?.test.components).toContain("TestBlock");
        expect(merged.categories?.test.components).toContain("AnotherBlock");
    });

    it("preserves core categories", async () => {
        const merged = await buildMergedBlockConfig();
        expect(merged.categories).toHaveProperty("layout");
        expect(merged.categories).toHaveProperty("content");
    });
});
