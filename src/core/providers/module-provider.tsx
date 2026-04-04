"use client";

import React, { createContext, useContext } from "react";

interface ModuleContextType {
    modules: Record<string, boolean>;
}

const ModuleContext = createContext<ModuleContextType>({ modules: {} });

export function ModuleProvider({
    children,
    moduleStates
}: {
    children: React.ReactNode;
    moduleStates: Record<string, boolean>;
}) {
    return (
        <ModuleContext.Provider value={{ modules: moduleStates }}>
            {children}
        </ModuleContext.Provider>
    );
}

export function useModuleStatus(moduleId: string): boolean {
    const { modules } = useContext(ModuleContext);
    // Module must be explicitly enabled (true). Missing = not installed = disabled.
    return modules[moduleId] === true;
}

export function useAllModules(): Record<string, boolean> {
    const { modules } = useContext(ModuleContext);
    return modules;
}
