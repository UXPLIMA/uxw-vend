
"use client";

import React from "react";
import { useTheme } from "@/core/providers/theme-provider";

interface ThemeSlotProps {
    name: string;
    defaultComponent: React.ReactNode;
    props?: Record<string, any>;
}

export function ThemeSlot({ name, defaultComponent, props = {} }: ThemeSlotProps) {
    const { activeTheme } = useTheme();

    // Check if the current theme has an override for this slot
    if (activeTheme?.components && activeTheme.components[name]) {
        const OverrideComponent = activeTheme.components[name]!;
        return <OverrideComponent {...props} />;
    }

    // Otherwise render default with props injected
    if (React.isValidElement(defaultComponent)) {
        return React.cloneElement(defaultComponent as React.ReactElement, props);
    }

    return <>{defaultComponent}</>;
}
