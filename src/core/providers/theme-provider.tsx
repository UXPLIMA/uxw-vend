"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme as useNextTheme, ThemeProvider as NextThemesProvider } from "next-themes";
import { themeRegistry, defaultThemeId as REGISTRY_DEFAULT } from "@/core/generated/theme-registry";
import { ThemeConfigProvider } from "@/core/lib/theme-config-client";
import type { ThemeManifest } from "@/core/lib/theme-manifest-schema";
import { applyOverrides } from "@/core/components/admin/theme-customizer/diff";

interface ThemeContextType {
    activeTheme: ThemeManifest | null;
    currentThemeId: string;
}

const ThemeContext = createContext<ThemeContextType>({ activeTheme: null, currentThemeId: REGISTRY_DEFAULT });

export const useTheme = () => useContext(ThemeContext);

function pickFallback(manifest: ThemeManifest | undefined, want: string): ThemeManifest {
    if (manifest) return manifest;
    return themeRegistry[want] ?? themeRegistry[REGISTRY_DEFAULT] ?? Object.values(themeRegistry)[0];
}

interface AppThemeProviderProps {
    children: ReactNode;
    defaultTheme: string;
    serverConfig?: Record<string, unknown>;
}

function ThemeContent({ children, defaultTheme, serverConfig }: AppThemeProviderProps) {
    const { theme: currentThemeId } = useNextTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const activeThemeId = (mounted && currentThemeId) ? currentThemeId : defaultTheme;

    const activeTheme = useMemo<ThemeManifest>(() => {
        return pickFallback(themeRegistry[activeThemeId], defaultTheme);
    }, [activeThemeId, defaultTheme]);

    // Sync data-theme / data-mode attributes. The generated theme-tokens.css
    // keys off data-theme (per-theme --uxw-* variables); data-mode drives
    // next-themes light/dark overrides used by some Tailwind utilities.
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.setAttribute("data-theme", activeTheme.id);
        document.documentElement.setAttribute("data-mode", activeTheme.type);
    }, [activeTheme]);

    // Live preview channel — when this page is rendered inside the customizer
    // iframe, the parent posts in-progress edits via postMessage. These
    // overrides are layered on top of serverConfig ONLY for preview.
    const [previewOverrides, setPreviewOverrides] = useState<Record<string, unknown> | null>(null);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.parent === window) return;
        const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === "uxwvend:theme-preview" && typeof event.data.overrides === "object") {
                setPreviewOverrides(event.data.overrides as Record<string, unknown>);
            }
        };
        window.addEventListener("message", handler);
        try { window.parent.postMessage({ type: "uxwvend:preview-ready" }, "*"); }
        catch { /* cross-origin — ignore */ }
        return () => window.removeEventListener("message", handler);
    }, []);

    const effectiveConfig = useMemo<Record<string, unknown>>(
        () => previewOverrides ? applyOverrides(serverConfig ?? {}, previewOverrides) : (serverConfig ?? {}),
        [serverConfig, previewOverrides],
    );

    // Pre-mount: flash of neutral background avoided by reading
    // generated tokens synchronously on mount (globals.css fallback :root).
    return (
        <ThemeContext.Provider value={{ activeTheme, currentThemeId: activeThemeId }}>
            <ThemeConfigProvider value={effectiveConfig}>{children}</ThemeConfigProvider>
        </ThemeContext.Provider>
    );
}

export function AppThemeProvider({ children, defaultTheme, serverConfig }: AppThemeProviderProps) {
    const themeIds = Object.keys(themeRegistry);
    return (
        <NextThemesProvider
            attribute="data-mode"
            defaultTheme={defaultTheme}
            themes={themeIds}
            enableSystem={false}
            disableTransitionOnChange
        >
            <ThemeContent defaultTheme={defaultTheme} serverConfig={serverConfig}>
                {children}
            </ThemeContent>
        </NextThemesProvider>
    );
}
