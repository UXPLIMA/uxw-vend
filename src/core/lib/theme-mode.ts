export interface ResolveModeInput {
    manifest: { modes: { default: string; available: Record<string, unknown> } };
    forced?: string | null;
    cookie?: string | null;
    systemPrefersDark?: boolean;
}

/**
 * Pick the active mode. Priority:
 *   1. Admin-forced (ThemeState.mode) if valid
 *   2. User cookie if valid
 *   3. prefers-color-scheme ("dark" if available)
 *   4. manifest.modes.default
 * A single-mode theme short-circuits every lookup.
 */
export function resolveMode(input: ResolveModeInput): string {
    const available = Object.keys(input.manifest.modes.available);
    if (available.length === 1) return available[0];

    const isValid = (m: string | null | undefined): m is string =>
        typeof m === "string" && available.includes(m);

    if (isValid(input.forced)) return input.forced;
    if (isValid(input.cookie)) return input.cookie;
    if (input.systemPrefersDark && available.includes("dark")) return "dark";
    return input.manifest.modes.default;
}
