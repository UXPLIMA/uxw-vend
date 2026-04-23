"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ThemeConfigValue = Record<string, unknown>;

const ThemeConfigContext = createContext<ThemeConfigValue>({});

export function ThemeConfigProvider({ value, children }: { value: ThemeConfigValue; children: ReactNode }) {
    // Callers pass a server-resolved snapshot — the reference is stable for
    // the request lifetime, so there's no benefit to a useMemo wrapper here.
    // Dropping it also keeps the react-hooks lint happy without introducing
    // a JSON.stringify dependency expression.
    return <ThemeConfigContext.Provider value={value}>{children}</ThemeConfigContext.Provider>;
}

export function useThemeConfig() {
    const ctx = useContext(ThemeConfigContext);
    return function get<T = unknown>(path: string, fallback?: T): T | undefined {
        const parts = path.split(".");
        let cur: unknown = ctx;
        for (const p of parts) {
            if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
                cur = (cur as Record<string, unknown>)[p];
            } else {
                return fallback;
            }
        }
        return (cur as T) ?? fallback;
    };
}
