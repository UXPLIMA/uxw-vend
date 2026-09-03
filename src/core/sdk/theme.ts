/**
 * uxwVend module SDK - active theme configuration.
 *
 * Its own entry point because `useThemeConfig` is a React context hook: it can
 * only be called from a client component, and folding it into the isomorphic
 * barrel would make that barrel client-only for every server file importing
 * `formatDate`.
 */
export { useThemeConfig } from "@/core/lib/theme-config-client";

/**
 * Renders a theme's override for a named component, falling back to core's
 * own. Lives here rather than in `/layout` because it is theme integration,
 * not page composition.
 */
export { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
