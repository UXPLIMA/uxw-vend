import { ThemeConfig, ThemeProperty } from "@/core/types/theme";

const schema: ThemeProperty[] = [
    // Colors — brand
    { key: "colors.primary", label: "Primary", type: "color", group: "Brand Colors", description: "Main accent — buttons, links, highlights" },
    { key: "colors.secondary", label: "Secondary", type: "color", group: "Brand Colors" },
    { key: "colors.accent", label: "Accent", type: "color", group: "Brand Colors" },

    // Colors — surfaces
    { key: "colors.background", label: "Background", type: "color", group: "Surfaces" },
    { key: "colors.foreground", label: "Foreground (text)", type: "color", group: "Surfaces" },
    { key: "colors.card", label: "Card", type: "color", group: "Surfaces" },
    { key: "colors.cardForeground", label: "Card text", type: "color", group: "Surfaces" },
    { key: "colors.muted", label: "Muted", type: "color", group: "Surfaces" },
    { key: "colors.mutedForeground", label: "Muted text", type: "color", group: "Surfaces" },
    { key: "colors.border", label: "Border", type: "color", group: "Surfaces" },

    // Colors — semantic
    { key: "colors.destructive", label: "Destructive", type: "color", group: "Semantic" },
    { key: "colors.success", label: "Success", type: "color", group: "Semantic" },
    { key: "colors.warning", label: "Warning", type: "color", group: "Semantic" },

    // Typography
    { key: "fonts.heading", label: "Heading font", type: "text", group: "Typography" },
    { key: "fonts.body", label: "Body font", type: "text", group: "Typography" },
    { key: "fonts.mono", label: "Monospace font", type: "text", group: "Typography" },

    // Layout
    { key: "radius", label: "Border radius", type: "text", group: "Layout", description: "CSS length — e.g. 0.5rem or 8px" },
];

export const flatTheme: ThemeConfig = {
    id: "flat",
    name: "Clean (Default)",
    description: "Clean, modern white theme with blue accents.",
    author: "uxwVend",
    version: "2.0.0",
    type: "light",

    colors: {
        primary: "#2563eb",
        secondary: "#7c3aed",
        accent: "#06b6d4",
        background: "#f3f4f6",
        foreground: "#111827",
        muted: "#f1f5f9",
        mutedForeground: "#64748b",
        border: "#e5e7eb",
        card: "#ffffff",
        cardForeground: "#111827",
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
    schema,
};
