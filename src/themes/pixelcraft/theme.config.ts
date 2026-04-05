import { ThemeConfig } from "@/core/types/theme";

export const pixelcraftTheme: ThemeConfig = {
    id: "pixelcraft",
    name: "PixelCraft",
    description: "Dark theme with pixel-art aesthetics and retro gaming vibes.",
    author: "uxwVend",
    version: "1.0.0",
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
    css: `
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        /* PixelCraft Theme Global Styles */
        body {
            background: #1a1a1a !important;
            color: #e8e8e8 !important;
        }

        /* Blocky pixel-art headings */
        h1, h2, h3 {
            font-family: 'Press Start 2P', monospace !important;
            letter-spacing: 1px;
            text-transform: uppercase;
            line-height: 1.6 !important;
        }

        h1 { font-size: 1.25rem !important; }
        h2 { font-size: 1rem !important; }
        h3 { font-size: 0.8rem !important; }

        /* Pixel-style buttons */
        button.inline-flex, a button.inline-flex {
            border-radius: 2px !important;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid rgba(255,255,255,0.1) !important;
            border-bottom: 3px solid rgba(0,0,0,0.3) !important;
        }

        button.inline-flex:active {
            border-bottom-width: 2px !important;
            transform: translateY(1px);
        }

        /* Cards */
        .bg-white, [class*="bg-card"] {
            background: #242424 !important;
            color: #e8e8e8 !important;
        }

        .bg-gray-50, .bg-gray-100 {
            background: #1a1a1a !important;
        }

        .border-gray-100, .border-gray-200 {
            border-color: #3a3a3a !important;
        }

        .text-gray-900, .text-gray-800 { color: #e8e8e8 !important; }
        .text-gray-700 { color: #c0c0c0 !important; }
        .text-gray-600, .text-gray-500 { color: #8c8c8c !important; }
        .text-gray-400 { color: #666 !important; }

        .hover\\:bg-gray-50:hover, .hover\\:bg-gray-100:hover {
            background: #333 !important;
        }

        .hover\\:text-gray-900:hover { color: #fff !important; }

        .shadow-sm, .shadow-lg {
            box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
        }

        input, textarea, select {
            background: #2a2a2a !important;
            border-color: #3a3a3a !important;
            color: #e8e8e8 !important;
        }

        /* Navbar dark */
        header {
            background: #242424 !important;
            border-color: #3a3a3a !important;
        }

        /* Admin sidebar */
        .admin-sidebar {
            background: #1e1e1e !important;
            border-color: #3a3a3a !important;
        }

        .admin-sidebar-link { color: #8c8c8c !important; }
        .admin-sidebar-link:hover { color: #e8e8e8 !important; background: #333 !important; }
        .admin-sidebar-link.active { color: #3ea72d !important; background: rgba(62,167,45,0.1) !important; }

        /* Green accent for primary elements */
        .text-primary { color: #3ea72d !important; }
        .bg-primary { background: #3ea72d !important; }

        /* Golden yellow for secondary/CTA */
        .text-blue-600, .text-blue-500 { color: #ffb800 !important; }
        .bg-blue-600, .bg-blue-50 { background: #ffb800 !important; color: #1a1a1a !important; }
        .hover\\:bg-blue-700:hover { background: #e0a000 !important; }
    `,
};
