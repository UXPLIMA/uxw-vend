
import { ThemeConfig } from "@/core/types/theme";

export const retroTheme: ThemeConfig = {
    id: "retro",
    name: "Retro",
    description: "Old school 8-bit style theme.",
    type: "light",
    colors: {
        primary: "#ff0000",
        secondary: "#0000ff",
        accent: "#ffff00",
        background: "#e0e0e0",
        foreground: "#000000",
        muted: "#c0c0c0",
        mutedForeground: "#404040",
        border: "#000000",
        card: "#ffffff",
        cardForeground: "#000000",
        destructive: "#ff0000",
        success: "#00ff00",
        warning: "#ffff00",
    },
    fonts: {
        heading: '"Courier New", monospace',
        body: '"Courier New", monospace',
        mono: '"Courier New", monospace',
    },
    radius: "0px",
    css: `
        /* Brutalist Retro Styles */
        * {
            border-radius: 0 !important;
        }
        
        .card, button.inline-flex, input.flex {
            border: 2px solid black !important;
            box-shadow: 4px 4px 0px black !important;
        }
        
        button:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px black !important;
        }
    `
};
