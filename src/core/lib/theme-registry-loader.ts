import type { ThemeManifest } from "./theme-manifest-schema";

/**
 * Merge a theme with its parent chain. Two levels max (grandchildren
 * rejected at schema level — we only follow one `parent` hop). Child
 * values win over parent values at the field level; anything the child
 * doesn't mention falls through.
 */
export function resolveMergedTheme(
    manifest: ThemeManifest,
    all: Record<string, ThemeManifest>,
    seen: Set<string> = new Set(),
): ThemeManifest {
    if (!manifest.parent) return manifest;

    if (seen.has(manifest.id)) {
        throw new Error(`Theme cycle detected at "${manifest.id}"`);
    }
    seen.add(manifest.id);

    const parent = all[manifest.parent];
    if (!parent) return manifest;

    const resolvedParent = resolveMergedTheme(parent, all, seen);

    return {
        ...resolvedParent,
        ...manifest,
        tokens: {
            colors: { ...(resolvedParent.tokens.colors ?? {}), ...(manifest.tokens.colors ?? {}) },
            fonts:  { ...(resolvedParent.tokens.fonts  ?? {}), ...(manifest.tokens.fonts  ?? {}) },
            radius: manifest.tokens.radius ?? resolvedParent.tokens.radius,
            space:  manifest.tokens.space  ?? resolvedParent.tokens.space,
        },
        config: { ...(resolvedParent.config ?? {}), ...(manifest.config ?? {}) },
    };
}
