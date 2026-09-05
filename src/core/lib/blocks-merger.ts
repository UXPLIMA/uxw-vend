import type { Config, ComponentConfig } from "@measured/puck";
import { coreBlockConfig } from "./blocks";
import { ModulePageBlocks } from "@/core/generated/module-blocks";
import { isEnabledIn } from "@/core/lib/module-enabled";

/**
 * Async-load all module-contributed Puck blocks and merge them into the
 * core block config. Core owns the block registry; the editor and the public
 * renderer that consume it are supplied by whichever module owns page
 * authoring, so no route is named here.
 *
 * Each module block module exports a Puck ComponentConfig as default.
 * Categories collected from manifest.pageBlocks[].category.
 *
 * Page blocks were the one module capability that ignored whether the module
 * was switched on. Slots, homepage widgets and sections, dashboard cards and
 * nav links all filter on `isEnabledIn`, and the proxy answers 404 for a
 * disabled module's pages and API routes - so a custom page carrying a block
 * from a module an admin had turned off still mounted the block, its fetch
 * came back 404, and the page rendered a silent empty region. The builder
 * offered the same block in its palette.
 */

export type BlockConfigMode = "edit" | "render";

export interface BlockConfigOptions {
    /** Enabled state per module id, exactly as the module provider holds it. */
    moduleStates: Record<string, boolean>;
    /**
     * What the config is for.
     *
     * `render` drops a disabled module's blocks outright: Puck skips a
     * component id its config does not carry, so the block disappears from the
     * public page rather than rendering an empty shell.
     *
     * `edit` keeps them loadable, so a page that already uses one still opens
     * and saves with its content intact, but takes them out of the palette so
     * no new one can be placed while the module is off.
     */
    mode: BlockConfigMode;
}

export async function buildMergedBlockConfig(options: BlockConfigOptions): Promise<Config> {
    const { moduleStates, mode } = options;

    const merged: Config = {
        components: { ...coreBlockConfig.components },
        categories: { ...(coreBlockConfig.categories || {}) },
    };

    for (const entry of ModulePageBlocks) {
        const enabled = isEnabledIn(moduleStates, entry.module);
        if (!enabled && mode === "render") continue;

        try {
            const mod = await entry.loader();
            const blockConfig = (mod.default || mod) as ComponentConfig;
            if (!blockConfig) continue;
            (merged.components as Record<string, ComponentConfig>)[entry.id] = blockConfig;

            // A disabled module's block stays loadable in the editor but is
            // not offered, so it cannot be added to another page.
            if (!enabled) continue;

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

    // A category whose only members came from a module that is now off would
    // otherwise sit in the palette as an empty heading.
    for (const [name, category] of Object.entries(merged.categories || {})) {
        if ((category.components || []).length === 0) delete merged.categories![name];
    }

    return merged;
}
