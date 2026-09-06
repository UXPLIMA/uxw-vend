import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The builder's inspector is not the one screen left in English.
 *
 * Puck renders a field's `label`, a select option's `label` and a category's
 * `title` exactly as the config carries them. The config is a plain object
 * built outside React, so there is nowhere in it to call a translator, and
 * that is how the whole page builder - seven blocks, thirty labels, twenty
 * two option names and the palette's own headings - stayed English on a panel
 * that was Turkish everywhere else.
 *
 * The library writes catalogue keys instead of sentences, and
 * `localizeBlockConfig` resolves them. This holds both halves to it: a label
 * has to be a key, and a key has to exist in both locales.
 */

const ROOT = process.cwd();

function read(file: string): string {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}

const BLOCKS = read("src/core/lib/blocks.tsx");
const en = JSON.parse(read("messages-core/en.json")) as Record<string, Record<string, string>>;
const tr = JSON.parse(read("messages-core/tr.json")) as Record<string, Record<string, string>>;

/** Every `label: "..."` and category `title: "..."` in the core library. */
function labels(): string[] {
    const found: string[] = [];
    for (const m of BLOCKS.matchAll(/\blabel: "([^"]*)"/g)) found.push(m[1]);
    for (const m of BLOCKS.matchAll(/^\s+title: "(blocks_[^"]*)"/gm)) found.push(m[1]);
    return found;
}

/**
 * Names a select option carries as a value rather than as prose. "H1" is the
 * tag, and translating it would be translating HTML.
 */
const NOT_PROSE = /^H[1-6]$/;

describe("the page builder speaks the operator's language", () => {
    it("finds the library and its labels", () => {
        expect(labels().length).toBeGreaterThan(30);
    });

    it("every label in the core block library is a key", () => {
        const offenders = labels().filter((label) => !NOT_PROSE.test(label) && !label.startsWith("blocks_"));
        expect(offenders, "write a blocks_* key and add it to both locales").toEqual([]);
    });

    it("every key the library uses exists in both locales", () => {
        const missing: string[] = [];
        for (const label of new Set(labels())) {
            if (!label.startsWith("blocks_")) continue;
            if (!en.admin?.[label]) missing.push(`en.admin.${label}`);
            if (!tr.admin?.[label]) missing.push(`tr.admin.${label}`);
        }
        expect(missing).toEqual([]);
    });

    it("the block that renders nothing says so in a key too", () => {
        expect(BLOCKS).not.toContain("No image");
        expect(en.common?.noImage).toBeTruthy();
        expect(tr.common?.noImage).toBeTruthy();
    });

    it("the editor resolves them and the public renderer does not", () => {
        const hook = read("src/core/lib/use-merged-block-config.ts");
        expect(hook).toContain("localizeBlockConfig");
        // `admin` is not a namespace a public page is given, so resolving on
        // the rendering path would be a lookup that can only ever miss.
        expect(hook).toContain('mode === "edit"');
    });

    it("a label the catalogue does not know is left as it was written", async () => {
        const { localizeBlockConfig } = await import("@/core/lib/blocks-i18n");
        const known: Record<string, string> = { blocks_field_title: "Baslik" };
        const t = Object.assign((key: string) => known[key], {
            has: (key: string) => key in known,
            rich: () => "",
            markup: () => "",
            raw: () => "",
        }) as unknown as Parameters<typeof localizeBlockConfig>[1];

        const config = {
            components: {
                Demo: {
                    label: "blocks_field_title",
                    fields: {
                        title: { type: "text", label: "blocks_field_title" },
                        size: {
                            type: "select",
                            label: "A module's own wording",
                            options: [{ label: "blocks_field_title", value: "a" }, { label: "Untouched", value: "b" }],
                        },
                    },
                    render: () => null,
                },
            },
            categories: {
                layout: { title: "blocks_field_title", components: ["Demo"] },
                community: { title: "blocks_cat_community", components: [] },
            },
        } as unknown as Parameters<typeof localizeBlockConfig>[0];

        const out = localizeBlockConfig(config, t);
        const demo = (out.components as Record<string, Record<string, unknown>>).Demo;
        const fields = demo.fields as Record<string, Record<string, unknown>>;
        expect(demo.label).toBe("Baslik");
        expect(fields.title.label).toBe("Baslik");
        expect(fields.size.label).toBe("A module's own wording");
        expect(fields.size.options).toEqual([{ label: "Baslik", value: "a" }, { label: "Untouched", value: "b" }]);

        const categories = out.categories as Record<string, Record<string, unknown>>;
        expect(categories.layout.title).toBe("Baslik");
        // A category no catalogue names reads as the word it was built from,
        // never as the key itself.
        expect(categories.community.title).toBe("Community");
    });
});
