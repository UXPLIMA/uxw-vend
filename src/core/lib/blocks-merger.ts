import type { Config, ComponentConfig } from "@measured/puck";
import { coreBlockConfig } from "./blocks";
import { ModulePageBlocks } from "@/core/generated/module-blocks";

/**
 * Async-load all module-contributed Puck blocks and merge them into the
 * core block config. Used by both the editor (/admin/page-builder/[id])
 * and the public renderer (custom-pages public view).
 *
 * Each module block module exports a Puck ComponentConfig as default.
 * Categories collected from manifest.pageBlocks[].category.
 */
export async function buildMergedBlockConfig(): Promise<Config> {
    const merged: Config = {
        components: { ...coreBlockConfig.components },
        categories: { ...(coreBlockConfig.categories || {}) },
    };

    for (const entry of ModulePageBlocks) {
        try {
            const mod = await entry.loader();
            const blockConfig = (mod.default || mod) as ComponentConfig;
            if (!blockConfig) continue;
            (merged.components as Record<string, ComponentConfig>)[entry.id] = blockConfig;

            const cat = entry.category || "modules";
            if (!merged.categories) merged.categories = {};
            if (!merged.categories[cat]) {
                merged.categories[cat] = {
                    title: cat.charAt(0).toUpperCase() + cat.slice(1),
                    components: [],
                };
            }
            const components = merged.categories[cat].components || [];
            if (!components.includes(entry.id)) {
                merged.categories[cat] = {
                    ...merged.categories[cat],
                    components: [...components, entry.id],
                };
            }
        } catch (err) {
            console.error(`[blocks-merger] Failed to load ${entry.module}/${entry.id}:`, err);
        }
    }

    return merged;
}
