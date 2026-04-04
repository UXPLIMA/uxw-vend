"use client";

import { useAllModules } from "@/core/providers/module-provider";
import {
    ModuleLayoutComponents as LayoutComponentList,
    LayoutComponentRegistry,
} from "@/core/generated/module-registry";

/**
 * Renders layout-level components from installed modules.
 * Each module can register layoutComponents in its manifest.
 * Only renders when the owning module is installed and enabled.
 * Zero hardcoded module names — everything from registry.
 */
export function ModuleLayoutComponents() {
    const modules = useAllModules();

    const enabled = LayoutComponentList
        .filter(lc => modules[lc.module] === true)
        .filter(lc => LayoutComponentRegistry[lc.id]);

    if (enabled.length === 0) return null;

    return (
        <>
            {enabled.map(lc => {
                const Component = LayoutComponentRegistry[lc.id];
                return <Component key={lc.id} />;
            })}
        </>
    );
}
