import { ThemeConfig } from "@/core/types/theme";

export const flatTheme: ThemeConfig = {
    id: "flat",
    name: "Neon Forge",
    description: "Premium dark gaming aesthetic with electric cyan accents.",
    author: "uxwVend",
    version: "2.0.0",
    type: "dark",

    colors: {
        primary: "#00d4ff",
        secondary: "#7c3aed",
        accent: "#06ffa5",
        background: "#080c14",
        foreground: "#e2e8f0",
        muted: "#111827",
        mutedForeground: "#64748b",
        border: "#1e293b",
        card: "#0f1520",
        cardForeground: "#e2e8f0",
        destructive: "#ff4757",
        success: "#00ffa5",
        warning: "#ffbe0b",
    },
    fonts: {
        heading: '"Outfit", sans-serif',
        body: '"Inter", sans-serif',
        mono: '"JetBrains Mono", monospace',
    },
    radius: "0.75rem",
};
