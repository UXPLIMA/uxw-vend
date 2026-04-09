import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Puck blocks registration smoke test.
 *
 * The custom-pages admin UI currently uses a RichTextEditor (not a drag-drop
 * Puck editor). Puck data rendering happens on the public side when a page's
 * content is serialized Puck JSON. This spec verifies that module-contributed
 * blocks are actually registered in the generated `module-blocks.ts`, which
 * is what would feed a Puck editor once one is wired up.
 *
 * The spec does NOT attempt to drive a Puck editor end-to-end because no
 * admin editor surface exists — that would be testing vapor.
 */
test.describe("Puck blocks registration", () => {
    test("module-blocks.ts contains expected module contributions", async () => {
        const blocksFile = path.resolve(__dirname, "../../src/core/generated/module-blocks.ts");
        const content = fs.readFileSync(blocksFile, "utf-8");

        // Expected blocks from Phase 11 adopters
        const expected = [
            "BlogLatestPosts",
            "BlogCategoryGrid",
            "ChangelogRecentEntries",
            "AnnouncementBanner",
            "SliderHero",
            "LeaderboardTop",
        ];

        for (const id of expected) {
            expect(content, `Expected block id "${id}" not found in module-blocks.ts`).toContain(`"${id}"`);
        }

        // Must export ModulePageBlocks as an array
        expect(content).toContain("export const ModulePageBlocks");
        expect(content).toContain("[");
    });

    test("module-blocks.ts loader paths resolve to module mirrors", async () => {
        const blocksFile = path.resolve(__dirname, "../../src/core/generated/module-blocks.ts");
        const content = fs.readFileSync(blocksFile, "utf-8");

        // Each block should import from @/modules/{moduleId}/blocks/...
        const importMatches = content.match(/import\(['"]@\/modules\/[^'"]+['"]\)/g) || [];
        expect(importMatches.length).toBeGreaterThanOrEqual(6);

        // No broken path shapes
        for (const imp of importMatches) {
            expect(imp).toMatch(/@\/modules\/[a-z-]+\/blocks\//);
        }
    });
});
