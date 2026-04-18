
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useTheme } from "@/core/providers/theme-provider";

interface ThemeSlotProps {
    name: string;
    defaultComponent: React.ReactNode;
    props?: Record<string, any>;
}

export function ThemeSlot({ name, defaultComponent, props = {} }: ThemeSlotProps) {
    const { activeTheme } = useTheme();

    if (activeTheme?.components && activeTheme.components[name]) {
        const OverrideComponent = activeTheme.components[name]!;
        return <OverrideComponent {...props} />;
    }

    if (Object.keys(props).length > 0 && React.isValidElement(defaultComponent)) {
        const element = defaultComponent as React.ReactElement<any>;
        const mergedProps = { ...(element.props || {}), ...props };
        if (props.children !== undefined) {
             
            const { children: _, ...restProps } = mergedProps;
            return React.cloneElement(element, restProps, props.children);
        }
        return React.cloneElement(element, mergedProps);
    }

    return <>{defaultComponent}</>;
}
