"use client";

import { useTheme } from "@/core/providers/theme-provider";
import { getThemeComponent } from "@/core/generated/theme-components";
import type { ComponentType, ReactNode } from "react";

/**
 * Render a named component, preferring the active theme's override if any.
 * Wrap every core layout component that a theme may legitimately replace.
 */
export function ThemeComponentSlot<P extends Record<string, unknown>>({
    name,
    fallback: Fallback,
    ...rest
}: {
    name: string;
    fallback: ComponentType<P>;
} & P): ReactNode {
    const { activeTheme } = useTheme();
    const Override = getThemeComponent(activeTheme?.id ?? "", name) as ComponentType<P> | null;
    const Comp = (Override ?? Fallback) as ComponentType<P>;
    return <Comp {...(rest as unknown as P)} />;
}
