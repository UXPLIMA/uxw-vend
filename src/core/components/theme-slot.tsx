
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

    // If props have content, use the default component's type to render with new props
    if (Object.keys(props).length > 0 && React.isValidElement(defaultComponent)) {
        const element = defaultComponent as React.ReactElement<any>;
        const elementProps = (element.props || {}) as Record<string, any>;
        const mergedProps = { ...elementProps, ...props };
        if (props.children !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { children: _children, ...restProps } = mergedProps;
            return React.cloneElement(element, restProps, props.children);
        }
        return React.cloneElement(element, mergedProps);
    }

    return <>{defaultComponent}</>;
}
