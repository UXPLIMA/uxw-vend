"use client";

import { usePathname } from "@/core/lib/i18n/navigation";
import { useAllModules } from "@/core/providers/module-provider";
import {
    ModuleLayoutComponents as LayoutComponentList,
    LayoutComponentRegistry,
} from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";

function matchPattern(path: string, pattern: string): boolean {
    if (pattern === "/*" || pattern === "*") return true;
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(path);
}

export function ModuleLayoutComponents() {
    const modules = useAllModules();
    const pathname = usePathname();
    // Strip locale prefix for matching (e.g. /tr/admin → /admin)
    const cleanPath = pathname?.replace(/^\/[a-z]{2}/, "") || "/";

    const enabled = LayoutComponentList
        .filter(lc => modules[lc.module] === true)
        .filter(lc => LayoutComponentRegistry[lc.id])
        .filter(lc => {
            // Check include patterns (default: show everywhere)
            if (lc.include && lc.include.length > 0) {
                if (!lc.include.some(p => matchPattern(cleanPath, p))) return false;
            }
            // Check exclude patterns
            if (lc.exclude && lc.exclude.length > 0) {
                if (lc.exclude.some(p => matchPattern(cleanPath, p))) return false;
            }
            return true;
        });

    if (enabled.length === 0) return null;

    return (
        <>
            {enabled.map(lc => {
                const Component = LayoutComponentRegistry[lc.id];
                return (
                    <ModuleErrorBoundary key={lc.id} fallbackLabel={`Failed to load ${lc.id}`}>
                        <Component />
                    </ModuleErrorBoundary>
                );
            })}
        </>
    );
}
