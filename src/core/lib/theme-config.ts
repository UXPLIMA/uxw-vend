// src/core/lib/theme-config.ts
// Thin facade over theme-state.ts. Preserves the existing public re-exports
// for callers that were importing from here. New code should import from
// `theme-state` directly.
export { getActiveTheme, setActiveTheme, type ActiveTheme } from "./theme-state";
export { ThemeConfigProvider, useThemeConfig, type ThemeConfigValue } from "./theme-config-client";
