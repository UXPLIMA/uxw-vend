/**
 * Shapes shared between the setup wizard and its steps.
 *
 * They live here rather than in page.tsx because every step file would
 * otherwise import from the page — a component importing its own parent route
 * module, which drags the whole wizard into each step's dependency graph.
 */

export interface ThemeOption {
    id: string;
    name: string;
    description?: string;
    suggestedModules?: string[];
}

export interface PresetOption {
    id: string;
    name: string;
    description: string;
    icon?: string;
    theme?: string;
    modules: string[];
}

export interface ModuleOption {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    dependencies: string[];
    conflicts: string[];
    version: string;
    coreVersion: string | null;
}

export interface SetupResult {
    success?: boolean;
    installedModules?: string[];
    autoAdded?: string[];
    failedModules?: Array<{ id: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
