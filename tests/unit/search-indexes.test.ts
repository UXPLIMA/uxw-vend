import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { moduleManifestSchema } from "@/core/lib/module-manifest-schema";
import { ftsExpression } from "../../scripts/ensure-search-indexes";

/**
 * Core used to carry `BlogArticle`, `ForumTopic`, `HelpArticle` and `Product`
 * in a hardcoded array in scripts/ensure-search-indexes.ts — four module
 * tables named in core, and an error line per uninstalled module on every
 * boot. The module that owns the table declares the index now, and these
 * cases are what keeps that safe.
 */

const base = {
    id: "demo",
    name: "Demo",
    description: "A demo module",
    version: "1.0.0",
    coreVersion: "^1.0.0",
};

const withIndexes = (indexes: unknown) => ({
    ...base,
    searchProviders: [
        { id: "demo-search", label: "Demo", handler: "search/handler.ts", indexes },
    ],
});

describe("searchProviders[].indexes", () => {
    it("accepts plain identifiers", () => {
        const r = moduleManifestSchema.safeParse(
            withIndexes([{ table: "DemoThing", columns: ["title", "body"] }]),
        );
        expect(r.success).toBe(true);
    });

    it("is optional", () => {
        const r = moduleManifestSchema.safeParse(withIndexes(undefined));
        expect(r.success).toBe(true);
    });

    // The identifiers are interpolated into DDL, so the schema is the only
    // thing between a manifest and arbitrary SQL.
    it("rejects anything that is not a plain SQL identifier", () => {
        const bad = [
            'Demo"; DROP TABLE "User',
            "Demo Thing",
            "demo-thing",
            "1Demo",
            "",
        ];
        for (const table of bad) {
            expect(
                moduleManifestSchema.safeParse(withIndexes([{ table, columns: ["title"] }])).success,
                `table: ${JSON.stringify(table)}`,
            ).toBe(false);
        }
        for (const column of bad) {
            expect(
                moduleManifestSchema.safeParse(withIndexes([{ table: "Demo", columns: [column] }])).success,
                `column: ${JSON.stringify(column)}`,
            ).toBe(false);
        }
    });

    it("requires at least one column", () => {
        const r = moduleManifestSchema.safeParse(withIndexes([{ table: "Demo", columns: [] }]));
        expect(r.success).toBe(false);
    });
});

describe("ftsExpression", () => {
    it("builds the same expression core used to hardcode", () => {
        expect(ftsExpression(["title", "excerpt", "content"])).toBe(
            `to_tsvector('english', coalesce("title", '') || ' ' || coalesce("excerpt", '') || ' ' || coalesce("content", ''))`,
        );
    });

    it("handles a single column without a separator", () => {
        expect(ftsExpression(["title"])).toBe(`to_tsvector('english', coalesce("title", ''))`);
    });
});

describe("the catalog still declares every index core used to hardcode", () => {
    // Dropping one of these would silently remove a full-text index from a
    // shipped module, and nothing else would notice.
    const expected: Record<string, string> = {
        blog: "BlogArticle",
        forum: "ForumTopic",
        "help-center": "HelpArticle",
        store: "Product",
    };

    for (const [moduleId, table] of Object.entries(expected)) {
        it(`${moduleId} owns ${table}`, () => {
            const manifest = JSON.parse(
                fs.readFileSync(path.join(process.cwd(), "module-sources", moduleId, "module.json"), "utf8"),
            ) as { searchProviders?: { indexes?: { table: string }[] }[] };
            const tables = (manifest.searchProviders ?? []).flatMap((sp) =>
                (sp.indexes ?? []).map((i) => i.table),
            );
            expect(tables).toContain(table);
        });
    }
});
