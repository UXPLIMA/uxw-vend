
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useTheme as useNextTheme, ThemeProvider as NextThemesProvider } from "next-themes";

import { themeRegistry } from "@/core/generated/theme-registry";

import { Theme } from "@/core/types/theme";

interface ThemeContextType {
    activeTheme: Theme | null;
    currentThemeId: string;
}

const ThemeContext = createContext<ThemeContextType>({
    activeTheme: null,
    currentThemeId: "flat",
});

export const useTheme = () => useContext(ThemeContext);

interface AppThemeProviderProps {
    children: React.ReactNode;
    defaultTheme: string;
}

function ThemeContent({
    children,
    defaultTheme
}: AppThemeProviderProps) {
    const { theme: currentThemeId } = useNextTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only mount detection
        setMounted(true);
    }, []);

    // Determine the actual theme object
    // If currentThemeId is 'system', we might rely on resolvedTheme to pick light/dark 
    // BUT our system maps 'theme names' to IDs.
    // For now, next-themes handles "flat", "obsidian" etc. as simple strings.
    const activeThemeId = (mounted && currentThemeId) ? currentThemeId : defaultTheme;
    const activeTheme = themeRegistry[activeThemeId] || themeRegistry[defaultTheme];

    // CSS Variable Injection
    useEffect(() => {
        if (!activeTheme) return;

        const root = document.documentElement;
        const colors = activeTheme.config.colors;
        const fonts = activeTheme.config.fonts;

        // Inject Colors
        root.style.setProperty("--color-primary", colors.primary);
        root.style.setProperty("--color-secondary", colors.secondary);
        root.style.setProperty("--color-accent", colors.accent);
        root.style.setProperty("--color-background", colors.background);
        root.style.setProperty("--color-foreground", colors.foreground);
        root.style.setProperty("--color-muted", colors.muted);
        root.style.setProperty("--color-muted-foreground", colors.mutedForeground);
        root.style.setProperty("--color-border", colors.border);
        root.style.setProperty("--color-card", colors.card);
        root.style.setProperty("--color-card-foreground", colors.cardForeground);
        root.style.setProperty("--color-destructive", colors.destructive);
        root.style.setProperty("--color-success", colors.success);
        root.style.setProperty("--color-warning", colors.warning);

        // Inject Fonts
        root.style.setProperty("--font-heading", fonts.heading);
        root.style.setProperty("--font-body", fonts.body);
        root.style.setProperty("--font-mono", fonts.mono);

        // Inject Radius
        root.style.setProperty("--radius", activeTheme.config.radius);

        // Inject Custom CSS
        // Remove old style tag if exists
        const oldStyle = document.getElementById("theme-custom-css");
        if (oldStyle) oldStyle.remove();

        if (activeTheme.config.css) {
            const style = document.createElement("style");
            style.id = "theme-custom-css";
            style.innerHTML = activeTheme.config.css;
            document.head.appendChild(style);
        }

    }, [activeTheme]);

    // Pre-mount: use theme config colors directly for loader
    const loaderBg = activeTheme?.config.colors.background || "#f3f4f6";
    const loaderColor = activeTheme?.config.colors.primary || "#2563eb";

    return (
        <ThemeContext.Provider value={{ activeTheme, currentThemeId: activeThemeId }}>
            {!mounted && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: loaderBg }}>
                    <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: `${loaderColor}20`, borderTopColor: loaderColor }} />
                </div>
            )}
            {children}
        </ThemeContext.Provider>
    );
}

export function AppThemeProvider({ children, defaultTheme }: AppThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme={defaultTheme}
            themes={Object.keys(themeRegistry)}
            enableSystem={false}
            disableTransitionOnChange
        >
            <ThemeContent defaultTheme={defaultTheme}>
                {children}
            </ThemeContent>
        </NextThemesProvider>
    );
}
