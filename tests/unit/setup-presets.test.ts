import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseSetupPresets, CUSTOM_PRESET } from "@/core/lib/setup-presets";

const valid = {
    version: "1.0.0",
    presets: [
        { id: "shop", name: "Shop", description: "d", icon: "Store", theme: "flat", modules: ["a", "b"] },
        { id: "custom", name: "Custom", modules: [] },
    ],
};

describe("parseSetupPresets", () => {
    it("parses a well-formed file", () => {
        const r = parseSetupPresets(valid);
        expect(r).toHaveLength(2);
        expect(r[0].modules).toEqual(["a", "b"]);
        expect(r[0].theme).toBe("flat");
    });

    it("defaults an omitted description to empty rather than failing", () => {
        const r = parseSetupPresets({ presets: [{ id: "x", name: "X", modules: [] }] });
        expect(r[0].description).toBe("");
    });

    it("degrades to custom-only on a malformed file instead of throwing", () => {
        const warnings: string[] = [];
        for (const bad of [null, {}, { presets: "nope" }, { presets: [{ id: "X!" , name: "n"}] }]) {
            const r = parseSetupPresets(bad, { onWarn: (m) => warnings.push(m) });
            expect(r).toEqual([CUSTOM_PRESET]);
        }
        expect(warnings.length).toBeGreaterThan(0);
    });

    it("drops unknown module ids instead of failing the preset", () => {
        const warnings: string[] = [];
        const r = parseSetupPresets(valid, {
            knownModuleIds: ["a"],
            onWarn: (m) => warnings.push(m),
        });
        expect(r[0].modules).toEqual(["a"]);
        expect(warnings.some((w) => w.includes("b"))).toBe(true);
    });

    it("ignores a duplicate preset id", () => {
        const warnings: string[] = [];
        const r = parseSetupPresets(
            { presets: [{ id: "x", name: "A", modules: [] }, { id: "x", name: "B", modules: [] }] },
            { onWarn: (m) => warnings.push(m) },
        );
        expect(r).toHaveLength(1);
        expect(r[0].name).toBe("A");
        expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
    });

    it("always leaves a way to choose manually", () => {
        const r = parseSetupPresets({ presets: [{ id: "only", name: "Only", modules: ["a"] }] });
        expect(r.some((p) => p.modules.length === 0)).toBe(true);
    });

    it("rejects a preset id that is not a slug", () => {
        expect(parseSetupPresets({ presets: [{ id: "../x", name: "n", modules: [] }] })).toEqual([
            CUSTOM_PRESET,
        ]);
    });
});

describe("shipped presets.json", () => {
    const root = process.cwd();
    const presetsRaw = JSON.parse(
        fs.readFileSync(path.join(root, "module-marketplace", "presets.json"), "utf8"),
    );
    const catalog = JSON.parse(
        fs.readFileSync(path.join(root, "module-marketplace", "index.json"), "utf8"),
    ) as { modules: Array<{ id: string }> };
    const knownModuleIds = catalog.modules.map((m) => m.id);

    it("parses without any warning", () => {
        const warnings: string[] = [];
        const presets = parseSetupPresets(presetsRaw, {
            knownModuleIds,
            onWarn: (m) => warnings.push(m),
        });
        expect(warnings).toEqual([]);
        expect(presets.length).toBeGreaterThan(1);
    });

    it("names only modules that exist in the catalog", () => {
        const known = new Set(knownModuleIds);
        for (const p of presetsRaw.presets) {
            for (const id of p.modules) {
                expect(known.has(id), `${p.id} -> ${id}`).toBe(true);
            }
        }
    });

    it("offers a manual path", () => {
        expect(presetsRaw.presets.some((p: { modules: string[] }) => p.modules.length === 0)).toBe(true);
    });

    // Module ids were already checked above; themes were not, and a preset
    // naming a theme that does not ship preselects nothing while still looking
    // like it chose one.
    it("names only themes that ship in-tree", () => {
        const themeIds = fs
            .readdirSync(path.join(root, "src", "themes"), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);

        for (const p of presetsRaw.presets as Array<{ id: string; theme?: string }>) {
            if (!p.theme) continue;
            expect(themeIds, `${p.id} -> ${p.theme}`).toContain(p.theme);
        }
    });
});
