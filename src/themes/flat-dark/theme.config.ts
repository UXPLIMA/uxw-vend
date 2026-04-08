import { ThemeConfig } from "@/core/types/theme";

/**
 * Flat Dark — child theme of "flat" with inverted surface colors.
 * Inherits everything (including the schema) from flat and only overrides
 * the colors that need to change. Demonstrates the child-theme system.
 */
export const flatDarkTheme: ThemeConfig = {
    id: "flat-dark",
    name: "Clean Dark",
    description: "Dark variant of the default Clean theme.",
    author: "uxwVend",
    version: "1.0.0",
    type: "dark",
    extends: "flat",

    colors: {
        primary: "#3b82f6",
        secondary: "#a78bfa",
        accent: "#22d3ee",
        background: "#0f172a",
        foreground: "#f1f5f9",
        muted: "#1e293b",
        mutedForeground: "#94a3b8",
        border: "#334155",
        card: "#1e293b",
        cardForeground: "#f1f5f9",
        destructive: "#ef4444",
        success: "#22c55e",
        warning: "#f59e0b",
    },
    fonts: {
        heading: '"Outfit", sans-serif',
        body: '"Inter", sans-serif',
        mono: '"JetBrains Mono", monospace',
    },
    radius: "0.625rem",

    // Inherits layout surfaces from the parent "flat" theme, but we declare
    // the slots here too so the child is self-documenting.
    slots: [
        "layout.top",
        "layout.bottom",
        "homepage.sidebar",
        "navbar.icons",
    ],

    cssVariables: [
        "--color-primary",
        "--color-secondary",
        "--color-accent",
        "--color-background",
        "--color-foreground",
        "--color-muted",
        "--color-muted-foreground",
        "--color-border",
        "--color-card",
        "--color-card-foreground",
        "--color-destructive",
        "--color-success",
        "--color-warning",
        "--font-heading",
        "--font-body",
        "--font-mono",
        "--radius",
    ],
};
