/**
 * Row shapes for the modules screen: what the install API returns and what the
 * marketplace catalogue returns. Separate on purpose - an installed module has
 * runtime state (enabled, version on disk) that a catalogue entry never has.
 */

/** One admin-editable setting a module declares in its manifest. */
export interface ModuleSettingDecl {
    key: string;
    type: "boolean" | "number" | "string";
    default: boolean | number | string;
    label: string;
    description?: string;
    min?: number;
    max?: number;
    maxLength?: number;
}

export type ModuleSettingValues = Record<string, boolean | number | string>;

export interface Module {
    id: string;
    name: string;
    description: string;
    version: string;
    icon?: string;
    enabled: boolean;
    /** What the manifest declares, so the form is built from the module itself. */
    settings?: ModuleSettingDecl[];
    /** Declared defaults overlaid with what the admin has saved. */
    config?: ModuleSettingValues;
    dependencies?: string[];
    conflicts?: string[];
    routes?: { public?: string[]; admin?: string[] };
    updateAvailable?: boolean;
    latestVersion?: string | null;
}

export interface MarketplaceModule {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    icon: string;
    category: string;
    verified: boolean;
    updatedAt: string;
    screenshots: string[];
    tags: string[];
    zip: string;
    dependencies: string[];
    stats: { publicRoutes: number; adminRoutes: number; apiRoutes: number; widgets: number };
}

export type SortKey = "newest" | "alphabetical";
