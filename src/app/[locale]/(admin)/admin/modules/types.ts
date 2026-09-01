/**
 * Row shapes for the modules screen: what the install API returns and what the
 * marketplace catalogue returns. Separate on purpose — an installed module has
 * runtime state (enabled, version on disk) that a catalogue entry never has.
 */

export interface Module {
    id: string;
    name: string;
    description: string;
    version: string;
    icon?: string;
    enabled: boolean;
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
