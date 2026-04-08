"use client";

import React from "react";
import { ContextProviderRegistry, ModuleContextProviders as ProviderList } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";

/**
 * Wraps children with React context providers registered by enabled modules.
 *
 * Modules declare context providers via the `contextProviders` field in module.json.
 * Unlike layoutComponents (rendered as siblings), these WRAP the children tree so
 * descendants can use hooks like useCurrency() etc.
 *
 * Composition is sorted by `order` (lower = outer wrap).
 */
export function ModuleContextProviders({ children }: { children: React.ReactNode }) {
    const moduleStatus = useAllModules();

    const enabled = ProviderList
        .filter((cp) => moduleStatus[cp.module] === true && (ContextProviderRegistry as Record<string, React.ComponentType<{ children: React.ReactNode }>>)[cp.id])
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    // Compose: lowest order = outermost wrap
    return enabled.reduceRight<React.ReactElement>((acc, cp) => {
        const Provider = (ContextProviderRegistry as Record<string, React.ComponentType<{ children: React.ReactNode }>>)[cp.id];
        return <Provider>{acc}</Provider>;
    }, <>{children}</>);
}
