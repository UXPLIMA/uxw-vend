
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
    conflicts?: string[];       // Modules that can't be active at the same time

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

    // Profile tabs — modules add their own tabs to user profile
    profileTabs?: {
        id: string;
        label: string;
        component: string;       // path to tab component
        order: number;           // render order
    }[];

    // OAuth login buttons — rendered on login/register pages
    oauthButtons?: {
        id: string;
        provider: string;        // NextAuth provider ID e.g. "discord"
        label: string;           // Button text e.g. "Discord"
        color: string;           // Brand color e.g. "#5865F2"
        svgIcon: string;         // SVG path data for icon
    }[];

    // Navbar components — rendered in navbar's right side (e.g. cart icon, notification bell)
    navbarComponents?: {
        id: string;
        component: string;   // path to component
        order: number;        // render order (lower = left)
    }[];

    // Layout components — rendered on every page when module is enabled
    layoutComponents?: {
        id: string;
        component: string;   // e.g. "@core/layout/LivePurchaseToast"
    }[];

    // Settings page cards — modules add their own settings buttons
    settingsCards?: {
        title: string;
        description: string;
        href: string;         // admin route path e.g. "/security"
        icon: string;         // Lucide icon name
        color: string;        // Tailwind color class e.g. "text-red-500"
    }[];

    // Dashboard integration — module provides its own stats
    statsApi?: string;  // e.g. "/store/stats" → GET /api/v1/store/stats returns { cards: [...], sections: [...] }

    // Homepage sections — modules register their own content areas
    homepageSections?: {
        id: string;
        type: "content" | "widget";   // content = main area, widget = sidebar
        component: string;             // path to component (e.g. "@core/widgets/xxx" or "components/xxx")
        order: number;                  // render order
    }[];

    dashboardCards?: {
        id: string;
        label: string;
        icon: string;
        href: string;
        color: string;
        statKey: string;
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
