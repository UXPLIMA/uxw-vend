"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type ThemeConfigValue = Record<string, unknown>;

const ThemeConfigContext = createContext<ThemeConfigValue>({});

export function ThemeConfigProvider({ value, children }: { value: ThemeConfigValue; children: ReactNode }) {
    const memoized = useMemo(() => value, [JSON.stringify(value)]);
    return <ThemeConfigContext.Provider value={memoized}>{children}</ThemeConfigContext.Provider>;
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
