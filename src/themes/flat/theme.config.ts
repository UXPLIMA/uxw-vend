import { ThemeConfig } from "@/core/types/theme";

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
};
