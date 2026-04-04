
/**
 * Dynamic Module System Types
 */

export interface ModuleManifest {
    id: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    icon?: string;
    permissions?: string[];
    defaultConfig?: Record<string, unknown>;
    menu?: {
        label: string;
        path: string; // Relative to /admin. e.g. "/store/products"
        icon?: string; // Icon name from Lucide
    }[];
    routes?: {
        path: string;
        component: string; // Relative path to component file from module root
        layout?: string;   // Optional layout component
    }[];
    adminRoutes?: {
        path: string; // Relative to /admin. e.g. "/store/products" -> /admin/store/products
        component: string;
    }[];
    api?: {
        path: string;
        handler: string; // Relative path to handler file
        method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";
    }[];

    dependencies?: string[];

    hooks?: {
        onEnable?: string;
        onDisable?: string;
    };

    widgets?: {
        id: string;
        component: string;
        defaultOrder: number;
        defaultVisible: boolean;
    }[];

    navLinks?: {
        label: string;
        href: string;
        icon?: string;
        position?: number;
    }[];

    footerLinks?: {
        label: string;
        href: string;
        section?: "quick" | "legal";
    }[];

    dashboardCards?: {
        id: string;
        label: string;
        icon: string;
        href: string;
        color: string;
        statKey: string;          // Key in the stats API response
    }[];

    dashboardSections?: {
        id: string;
        title: string;
        component: string;        // Path to component or "@api" for API-driven
        position: "main" | "sidebar";
        order: number;
    }[];
}

export interface LoadedModule {
    manifest: ModuleManifest;
    path: string; // Absolute path to module directory
    enabled: boolean;
}

// Retaining legacy types if needed or for database mapping
export interface ModuleState {
    id: string;
    enabled: boolean;
    config: Record<string, unknown>;
}

export interface ModuleDefinition extends ModuleManifest {
    // Alias to keep compatibility if needed
}
