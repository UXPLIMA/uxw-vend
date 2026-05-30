
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
        // Which core admin nav group to attach this item to (see
        // admin-nav-groups.ts). Omit to fall back to the generic "modules"
        // bucket. Known core groups: commerce, content, design, activity,
        // advanced, marketplace, settings.
        group?: string;
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
        description?: string; // Optional OpenAPI summary (used by /api/v1/openapi)
    }[];

    dependencies?: string[];
    conflicts?: string[];       // Modules that can't be active at the same time

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

    // Storage providers — implement the StorageProvider interface from @/core/lib/storage
    // Used by core's file upload system. Multiple providers can coexist; the active one is
    // selected via the `storage_active_provider` Setting key (or STORAGE_PROVIDER env var).
    storageProviders?: {
        id: string;          // unique provider id, e.g. "cloudflare-r2"
        name: string;        // human-readable, e.g. "Cloudflare R2"
        handler: string;     // path to file exporting `default: StorageProvider`
    }[];

    // Context providers — React components that wrap the entire app tree.
    // Use for context (CurrencyProvider, ThemeProvider, etc.) that descendants need to consume.
    // Unlike layoutComponents (rendered as siblings), contextProviders WRAP children.
    contextProviders?: {
        id: string;          // unique id
        component: string;   // path to file exporting the provider (default or named)
        order?: number;      // wrap order (lower = outer)
    }[];

    // Hook listeners — actions/filters the module subscribes to.
    // Each entry points to a file exporting default: (payload, context?) => ... (or returns new value for filters).
    // Wired into a build-time registry so listeners are bundled as static imports.
    // Listeners are automatically registered when the module is enabled and removed on disable.
    hookListeners?: {
        hook: string;         // hook name, e.g. "user.registered" or "post.content"
        type: "action" | "filter";
        handler: string;      // path to file (relative to module root) exporting default fn
        priority?: number;    // default 10; lower runs earlier
    }[];

    // Slot contributions — React components that render into named <Slot>
    // points declared by other modules (or by core templates). Used by the
    // module-extends-module mechanism.
    slotContents?: {
        id: string;           // unique id
        slot: string;         // slot name, e.g. "blog.article.belowContent"
        component: string;    // path to component file
        order?: number;       // render order within the slot (lower first)
    }[];

    // Page-builder blocks — custom Puck blocks the module contributes.
    // Each entry points to a module file that exports a Puck-compatible
    // ComponentConfig as its default export. Merged into the page editor
    // and renderer at build time.
    pageBlocks?: {
        id: string;           // unique component name (e.g. "ProductGrid")
        category?: string;    // sidebar category in the editor
        component: string;    // path to the file relative to module root
    }[];

    // Cron jobs — periodic tasks run by the core scheduler.
    // Schedule keywords: every-minute | every-5-minutes | every-15-minutes
    //                    every-hour | every-day | every-week | every-month
    cronJobs?: {
        id: string;           // unique within the module
        schedule: string;
        handler: string;      // path to file exporting default async fn
    }[];

    // Public search providers — handlers the /search endpoint queries
    // when a user searches the site. Handler default-exports an async
    // function: (query: string) => Promise<SearchResult[]>
    searchProviders?: {
        id: string;           // e.g. "blog-articles"
        label: string;        // group label in results UI
        handler: string;      // path to file exporting default async fn
        icon?: string;        // Lucide icon name shown on the result group card
    }[];

    // Activity-feed title localization — modules that emit activity events
    // declare how to localize their English-formatted titles. Core strips
    // `prefix` from the stored title and substitutes the translation under
    // the "activity" namespace `key`. Keeps core ignorant of module events.
    activityTitles?: {
        type: string;         // activity event type, e.g. "forum.topic.created"
        prefix: string;       // English prefix to strip, e.g. "New topic: "
        key: string;          // translation key under "activity", e.g. "forumTopicCreated"
    }[];

    // RBAC resource strings the module owns (e.g. "blog.article"). Surfaced
    // in the admin permission matrix so admins can grant/deny per resource.
    permissionResources?: string[];

    // Inbound webhook receivers — external services can POST to
    // /api/v1/webhook/<provider> and the dispatcher routes to the
    // matching handler. Handler default-exports:
    //   (request: Request) => Promise<{ status: number; body?: unknown }>
    // Optional signatureHeader + secretEnv enables HMAC verification.
    webhookReceivers?: {
        provider: string;     // unique slug — used in the URL
        handler: string;      // path to file exporting default async fn
        signatureHeader?: string;  // e.g. "stripe-signature"
        secretEnv?: string;        // env var holding the shared secret
    }[];

    // User-facing notification types — surfaces in the profile preferences
    // grid so users can opt out of specific event types per channel.
    // Modules contribute their event types here so users see them.
    notificationTypes?: {
        eventType: string;    // matches the hook name, e.g. "blog.article.created"
        label: string;        // human-readable label
        description?: string;
        channels?: string[];  // ["email", "inapp"] — default both
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

    // SEO sitemap contributor — module decides which of its URLs should
    // appear in the sitemap. Handler default-exports an async function:
    //   () => Promise<SitemapEntry[]>
    seoRoutes?: {
        handler: string;   // path to file exporting default async fn
    };

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

    // GDPR user-data-export contributions — tables to dump into the
    // user's personal data export. Each entry maps a Prisma delegate to
    // the column holding the user FK and a grouping key under modules.<key>
    // in the exported JSON. Tables whose delegate isn't on the runtime
    // Prisma client (uninstalled module) are silently skipped by core.
    userDataExport?: {
        model: string;   // Prisma delegate name (e.g. "blogArticle")
        key: string;     // grouping key in the export (e.g. "blog.articles")
        column: string;  // FK column to user id (e.g. "authorId")
    }[];

    // Moderation queue contributors — modules that own moderatable
    // content (comments, posts, suggestions) plug into the unified
    // admin moderation view. Handler default-exports an object:
    //   { list(skip, take), count(), bulkUpdate(ids, action) }
    moderationProviders?: {
        id: string;          // unique slug e.g. "blog-comment", used in URLs
        label: string;       // human-readable label e.g. "Blog comments"
        labelKey?: string;   // optional i18n key (admin namespace) for the queue tab label
        settingKey?: string; // key under Setting "moderation" controlling auto/manual mode
        settingLabelKey?: string;  // optional i18n key for the settings-page row label
        settingDescKey?: string;   // optional i18n key for the settings-page row description
        handler: string;     // path to handler file relative to module root
    }[];
}

/**
 * A module discovered on the filesystem. `enabled` is deliberately NOT
 * part of this type — the DB (`ModuleConfig.enabled`, surfaced via
 * `getModuleStates()` in `module-cache.ts`) is the single source of truth
 * for whether a module is active. Past versions hardcoded `enabled: true`
 * here and fooled consumers into treating filesystem presence as activation.
 */
export interface LoadedModule {
    manifest: ModuleManifest;
    path: string;
}

export interface ModuleState {
    id: string;
    enabled: boolean;
    config: Record<string, unknown>;
}

export type ModuleDefinition = ModuleManifest;
