// Shared types for the marketplace route + rating sub-routes. Not a route
// file — safe to export plain types/helpers.

export interface MarketplaceModuleStats {
    publicRoutes: number;
    adminRoutes: number;
    apiRoutes: number;
    widgets: number;
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
    downloads: number;
    rating: number | null;
    ratingCount: number;
    updatedAt: string;
    screenshots: string[];
    tags: string[];
    zip: string;
    dependencies: string[];
    stats: MarketplaceModuleStats;
}

export interface MarketplaceIndex {
    version: string;
    updated?: string;
    updatedAt?: string;
    modules: MarketplaceModule[];
}
