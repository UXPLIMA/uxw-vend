
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

    seedOnInstall?: boolean;

    // Module translations — merged into core messages at runtime
    translations?: {
        [locale: string]: Record<string, string | Record<string, string>>;
    };

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

    // Footer components — rendered in the footer (e.g. currency selector next to language)
    footerComponents?: {
        id: string;
        component: string;   // path to component
        section?: string;    // optional footer section name (default: "settings")
        order?: number;      // render order (lower = first)
    }[];

    // Layout components — rendered on every page when module is enabled
    layoutComponents?: {
        id: string;
        component: string;
        include?: string[];   // URL patterns to show on (e.g. ["/*"] for all, ["/store/*"])
        exclude?: string[];   // URL patterns to hide on (e.g. ["/admin/*"])
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
        labelKey?: string;  // i18n key (admin namespace) — preferred over `label` when present
        icon: string;
        href: string;
        color: string;
        statKey: string;
    }[];
}

export interface LoadedModule {
    manifest: ModuleManifest;
    path: string;
    enabled: boolean;
}

export interface ModuleState {
    id: string;
    enabled: boolean;
    config: Record<string, unknown>;
}

export type ModuleDefinition = ModuleManifest;
