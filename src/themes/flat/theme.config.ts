
import { ThemeConfig } from "@/core/types/theme";

export const flatTheme: ThemeConfig = {
    id: "flat",
    name: "Flat (Default)",
    description: "The default Clean & Modern uxwVend theme.",
    type: "light", // Based on globals.css defaults (even though layout forces dark, variables look mixed/light-ish base? Actually looks like light mode defaults effectively)
    // Wait, globals.css has #f3f4f6 for background (light gray). 
    // And layout.tsx has className="dark". This is a conflict in the legacy code.
    // The previous theme.ts had "default" as dark mode with #09090b. 
    // But globals.css is DEFINITELY light mode colors (#ffffff cards).
    // I will preserve EXACTLY what is in globals.css. 

    colors: {
        primary: "#2563eb",
        secondary: "#06b6d4",
        accent: "#22d3ee",
        background: "#f3f4f6",
        foreground: "#111827",
        muted: "#e5e7eb",
        mutedForeground: "#6b7280",
        border: "#e5e7eb", // Derived from muted usually, or separate. globals.css doesn't validly define --color-border explicitly in :root but uses it in @theme?
        // Checking globals.css again... var(--color-border) is NOT in :root.
        // It is used in theme.ts previously as #27272a.
        // I should check if tailwind v4 infers it or if I need to add it.
        // I will add a reasonable default if missing, or check if it's there. 
        // Logic: globals.css line 1-25 does NOT have border.
        // usage later? No.
        // I will use muted for border for now to be safe.
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
    radius: "0.75rem",
};
