import { ThemeConfig, ThemeProperty } from "@/core/types/theme";

// Identical schema shape to the "flat" theme — gives the customizer the same
// set of editable knobs. Colors still follow PixelCraft's green-on-dark
// identity by default, but they're now user-overridable.
const schema: ThemeProperty[] = [
    // Brand
    { key: "colors.primary", label: "Primary", type: "color", group: "Brand Colors", description: "Retro green accent — buttons, links, highlights" },
    { key: "colors.secondary", label: "Secondary", type: "color", group: "Brand Colors", description: "Golden yellow accent" },
    { key: "colors.accent", label: "Accent", type: "color", group: "Brand Colors" },

    // Surfaces
    { key: "colors.background", label: "Background", type: "color", group: "Surfaces" },
    { key: "colors.foreground", label: "Foreground (text)", type: "color", group: "Surfaces" },
    { key: "colors.card", label: "Card", type: "color", group: "Surfaces" },
    { key: "colors.cardForeground", label: "Card text", type: "color", group: "Surfaces" },
    { key: "colors.muted", label: "Muted", type: "color", group: "Surfaces" },
    { key: "colors.mutedForeground", label: "Muted text", type: "color", group: "Surfaces" },
    { key: "colors.border", label: "Border", type: "color", group: "Surfaces" },

    // Semantic
    { key: "colors.destructive", label: "Destructive", type: "color", group: "Semantic" },
    { key: "colors.success", label: "Success", type: "color", group: "Semantic" },
    { key: "colors.warning", label: "Warning", type: "color", group: "Semantic" },

    // Typography
    { key: "fonts.heading", label: "Heading font", type: "text", group: "Typography", description: "Defaults to 'Press Start 2P' for that pixel-art look" },
    { key: "fonts.body", label: "Body font", type: "text", group: "Typography" },
    { key: "fonts.mono", label: "Monospace font", type: "text", group: "Typography" },

    // Layout
    { key: "radius", label: "Border radius", type: "text", group: "Layout", description: "CSS length — PixelCraft defaults to 4px for sharp corners" },
];

export const pixelcraftTheme: ThemeConfig = {
    id: "pixelcraft",
    name: "PixelCraft",
    description: "Dark theme with pixel-art aesthetics and retro gaming vibes.",
    author: "uxwVend",
    version: "1.1.0",
    type: "dark",

    colors: {
        primary: "#3ea72d",
        secondary: "#ffb800",
        accent: "#52a535",
        background: "#1a1a1a",
        foreground: "#e8e8e8",
        muted: "#2a2a2a",
        mutedForeground: "#8c8c8c",
        border: "#3a3a3a",
        card: "#242424",
        cardForeground: "#e8e8e8",
        destructive: "#d32f2f",
        success: "#3ea72d",
        warning: "#ffb800",
    },
    fonts: {
        heading: '"Press Start 2P", "Outfit", monospace',
        body: '"Inter", sans-serif',
        mono: '"JetBrains Mono", monospace',
    },
    radius: "4px",

    /*
     * Retro styling that can't be expressed via plain design tokens — blocky
     * headings, pixel borders on buttons, etc. All colors here reference the
     * theme's CSS variables so the customizer can retheme PixelCraft without
     * touching this string.
     */
    css: `
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        /* PixelCraft global base — derived from theme CSS variables */
        body {
            background: var(--color-background);
            color: var(--color-foreground);
        }

        /* Blocky pixel-art headings */
        h1, h2, h3 {
            font-family: var(--font-heading);
            letter-spacing: 1px;
            text-transform: uppercase;
            line-height: 1.6;
        }

        h1 { font-size: 1.25rem; }
        h2 { font-size: 1rem; }
        h3 { font-size: 0.8rem; }

        /* Pixel-style buttons — retro chunky border, color from --color-primary */
        button.inline-flex, a button.inline-flex {
            border-radius: var(--radius);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid rgba(255,255,255,0.1);
            border-bottom: 3px solid rgba(0,0,0,0.3);
        }

        button.inline-flex:active {
            border-bottom-width: 2px;
            transform: translateY(1px);
        }

        /* Shadow tuned for dark surfaces */
        .shadow-sm, .shadow-lg {
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        /* Form controls pick up theme variables */
        input, textarea, select {
            background: var(--color-muted);
            border-color: var(--color-border);
            color: var(--color-foreground);
        }
    `,

    schema,

    // Template slots PixelCraft's layout components render. Modules can
    // inject content at any of these points without patching this theme.
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
