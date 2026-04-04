"use client";

// Re-export from module provider for backward compatibility
export { useModuleStatus, useAllModules } from "@/core/providers/module-provider";

// Backward-compatible aliases
import { useModuleStatus, useAllModules } from "@/core/providers/module-provider";

export function useModuleEnabled(moduleId: string) {
    const enabled = useModuleStatus(moduleId);
    return { enabled, loading: false };
}

export function useModules() {
    const modules = useAllModules();
    return { modules, loading: false };
}

// No-op for backward compatibility
export function clearModuleCache() {}
