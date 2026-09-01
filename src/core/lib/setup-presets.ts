import { z } from "zod";

/**
 * Site-type presets for the first-run wizard.
 *
 * Presets live in `module-marketplace/presets.json` — catalog data, read the
 * same way `index.json` is. Core names no module: if this file listed the
 * bundles itself, "core knows nothing about any module" would stop being true
 * the moment a preset mentioned `store`.
 */

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

const presetSchema = z.object({
    id: z.string().min(1).max(64).regex(SAFE_ID),
    name: z.string().min(1).max(100),
    description: z.string().max(500).default(""),
    /** Lucide icon name, rendered by the wizard. */
    icon: z.string().min(1).max(64).regex(/^[A-Za-z0-9]+$/).optional(),
    /** Theme to preselect. A suggestion — the theme step still opens. */
    theme: z.string().min(1).max(64).regex(SAFE_ID).optional(),
    modules: z.array(z.string().regex(SAFE_ID)).max(50).default([]),
});

export const presetFileSchema = z.object({
    version: z.string().max(32).optional(),
    presets: z.array(presetSchema).max(20),
});

export type SetupPreset = z.infer<typeof presetSchema>;

/**
 * The always-available escape hatch. Returned on its own when the presets file
 * is missing or malformed: a broken data file must never block first-run
 * setup, it should just cost the operator the shortcut.
 */
export const CUSTOM_PRESET: SetupPreset = {
    id: "custom",
    name: "I'll choose myself",
    description: "Start from nothing and pick modules by hand.",
    icon: "SlidersHorizontal",
    modules: [],
};

export interface ParsePresetsOptions {
    /**
     * Module ids that actually exist in the catalog. Ids outside it are
     * dropped from each preset rather than failing the parse — a preset that
     * names a module this deployment doesn't ship should install what it can,
     * not break the wizard.
     */
    knownModuleIds?: readonly string[];
    onWarn?: (message: string) => void;
}

export function parseSetupPresets(raw: unknown, options: ParsePresetsOptions = {}): SetupPreset[] {
    const warn = options.onWarn ?? (() => {});
    const parsed = presetFileSchema.safeParse(raw);
    if (!parsed.success) {
        warn(`[setup-presets] malformed presets file: ${parsed.error.issues[0]?.message ?? "unknown"}`);
        return [CUSTOM_PRESET];
    }

    const known = options.knownModuleIds ? new Set(options.knownModuleIds) : null;
    const seen = new Set<string>();
    const presets: SetupPreset[] = [];

    for (const preset of parsed.data.presets) {
        if (seen.has(preset.id)) {
            warn(`[setup-presets] duplicate preset id "${preset.id}" ignored`);
            continue;
        }
        seen.add(preset.id);

        let modules = preset.modules;
        if (known) {
            const dropped = modules.filter((m) => !known.has(m));
            if (dropped.length > 0) {
                warn(`[setup-presets] preset "${preset.id}" names unknown modules: ${dropped.join(", ")}`);
                modules = modules.filter((m) => known.has(m));
            }
        }
        presets.push({ ...preset, modules });
    }

    // The custom path must always be reachable, even if the data file forgot it.
    if (!presets.some((p) => p.modules.length === 0)) {
        presets.push(CUSTOM_PRESET);
    }
    return presets;
}
