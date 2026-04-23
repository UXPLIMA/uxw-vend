/**
 * Admin sidebar navigation group definitions.
 *
 * The admin shell is a two-level navigation:
 *   1. An icon rail on the far left (w-14) with one icon per group
 *   2. A contextual sidebar (w-56) next to it showing the items for the
 *      currently-selected group
 *
 * Each top-level group contains sections with items. A section can have
 * an optional header label that renders as a small uppercase title in
 * the contextual sidebar (like "User Management", "Actions").
 *
 * Module contributions: modules declare `menu[]` in their manifest with
 * an optional `group` field. If a module item doesn't declare a group,
 * `inferModuleGroup(moduleId)` is used to pick a sensible default based
 * on the module's id (content / commerce / community / other).
 *
 * Core items live in the `CORE_NAV_GROUPS` constant; module items are
 * merged at render time in the sidebar component.
 */

import type { ComponentType } from "react";
import { themeRegistry } from "@/core/generated/theme-registry";
import { themeAdminRoutes, type ThemeAdminNavItem } from "@/core/generated/theme-admin-routes";
import {
    LayoutDashboard,
    Users,
    FileText,
    ShoppingBag,
    Palette,
    Package,
    Activity,
    LineChart,
    Wrench,
    Settings,
    History,
    ShieldCheck,
    ShieldOff,
    AlertTriangle,
    ScrollText,
    Clock,
    Inbox,
    Database,
    Gauge,
    Bell,
    Award,
    KeyRound,
    FileJson,
    ImageIcon,
    Navigation,
    PanelBottom,
    LayoutGrid,
    Code,
    Globe,
    ClipboardCheck,
    ShieldAlert,
    Megaphone,
    Server,
    Cog,
} from "lucide-react";

export interface NavItem {
    href: string;
    label: string;
    labelKey?: string;
    icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface NavSection {
    header?: string;
    headerKey?: string;
    items: NavItem[];
}

export interface NavGroup {
    id: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    label: string;
    labelKey?: string;
    sections: NavSection[];
    /** If a path under this prefix is active, this group is selected. */
    pathPrefix?: string | string[];
}

/**
 * Core navigation groups — these are always present regardless of
 * installed modules. Modules extend groups at render time.
 */
export const CORE_NAV_GROUPS: NavGroup[] = [
    {
        id: "dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        labelKey: "sidebar_dashboard",
        pathPrefix: ["/admin", "/admin/analytics", "/admin/observability"],
        sections: [
            {
                items: [
                    { href: "/admin", label: "Overview", labelKey: "sidebar_overview", icon: LayoutDashboard },
                    { href: "/admin/analytics", label: "Analytics", labelKey: "sidebar_analytics", icon: LineChart },
                    { href: "/admin/observability", label: "Observability", labelKey: "sidebar_observability", icon: Activity },
                ],
            },
        ],
    },
    {
        id: "users",
        icon: Users,
        label: "Users",
        labelKey: "sidebar_users",
        pathPrefix: ["/admin/users", "/admin/roles", "/admin/permissions", "/admin/warnings", "/admin/ip-blocks"],
        sections: [
            {
                header: "User Management",
                headerKey: "sidebar_userManagement",
                items: [
                    { href: "/admin/users", label: "Users", labelKey: "sidebar_users", icon: Users },
                    { href: "/admin/roles", label: "Roles", labelKey: "sidebar_roles", icon: ShieldCheck },
                    { href: "/admin/permissions", label: "Permissions", labelKey: "sidebar_permissions", icon: ClipboardCheck },
                    { href: "/admin/resource-permissions", label: "Resource Grants", labelKey: "sidebar_resourcePermissions", icon: ShieldCheck },
                ],
            },
            {
                header: "Moderation",
                headerKey: "sidebar_moderation",
                items: [
                    { href: "/admin/warnings", label: "Warnings", labelKey: "sidebar_warnings", icon: AlertTriangle },
                    { href: "/admin/ip-blocks", label: "IP Blocks", labelKey: "sidebar_ipBlocks", icon: ShieldOff },
                ],
            },
        ],
    },
    {
        id: "content",
        icon: FileText,
        label: "Content",
        labelKey: "sidebar_content",
        pathPrefix: ["/admin/moderation", "/admin/revisions", "/admin/broadcasts"],
        sections: [
            {
                header: "Workflow",
                headerKey: "sidebar_workflow",
                items: [
                    { href: "/admin/moderation", label: "Moderation Queue", labelKey: "sidebar_moderationQueue", icon: ShieldAlert },
                    { href: "/admin/revisions", label: "Revisions", labelKey: "sidebar_revisions", icon: History },
                    { href: "/admin/broadcasts", label: "Broadcasts", labelKey: "sidebar_broadcasts", icon: Megaphone },
                ],
            },
        ],
    },
    {
        id: "commerce",
        icon: ShoppingBag,
        label: "Commerce",
        labelKey: "sidebar_commerce",
        sections: [
            // Modules contribute here
        ],
    },
    {
        id: "design",
        icon: Palette,
        label: "Design",
        labelKey: "sidebar_design",
        pathPrefix: ["/admin/settings/navbar", "/admin/settings/footer", "/admin/settings/widgets", "/admin/settings/css", "/admin/media"],
        sections: [
            {
                header: "Appearance",
                headerKey: "sidebar_appearance",
                items: [
                    { href: "/admin/settings/theme", label: "Theme Library", labelKey: "sidebar_themeLibrary", icon: Palette },
                    { href: "/admin/settings/css", label: "Custom CSS", labelKey: "sidebar_customCss", icon: Code },
                ],
            },
            {
                header: "Layout",
                headerKey: "sidebar_layout",
                items: [
                    { href: "/admin/settings/navbar", label: "Navbar", labelKey: "sidebar_navbar", icon: Navigation },
                    { href: "/admin/settings/footer", label: "Footer", labelKey: "sidebar_footer", icon: PanelBottom },
                    { href: "/admin/settings/widgets", label: "Widgets", labelKey: "sidebar_widgets", icon: LayoutGrid },
                ],
            },
            {
                header: "Media",
                headerKey: "sidebar_media",
                items: [
                    { href: "/admin/media", label: "Media Library", labelKey: "sidebar_mediaLibrary", icon: ImageIcon },
                ],
            },
        ],
    },
    {
        id: "marketplace",
        icon: Package,
        label: "Marketplace",
        labelKey: "sidebar_marketplace",
        pathPrefix: ["/admin/modules"],
        sections: [
            {
                items: [
                    { href: "/admin/modules", label: "Modules", labelKey: "sidebar_modules", icon: Package },
                ],
            },
        ],
    },
    {
        id: "activity",
        icon: Activity,
        label: "Activity",
        labelKey: "sidebar_activity",
        pathPrefix: ["/admin/activity-log", "/admin/audit-log", "/admin/trophies"],
        sections: [
            {
                header: "History",
                headerKey: "sidebar_history",
                items: [
                    { href: "/admin/activity-log", label: "Activity Log", labelKey: "sidebar_activityLog", icon: ScrollText },
                    { href: "/admin/audit-log", label: "Audit Log", labelKey: "sidebar_auditLog", icon: ScrollText },
                ],
            },
            {
                header: "Engagement",
                headerKey: "sidebar_engagement",
                items: [
                    { href: "/admin/trophies", label: "Trophies", labelKey: "sidebar_trophies", icon: Award },
                ],
            },
        ],
    },
    {
        id: "advanced",
        icon: Wrench,
        label: "Advanced",
        labelKey: "sidebar_advanced",
        pathPrefix: ["/admin/cron", "/admin/email-queue", "/admin/backup", "/admin/api-docs", "/admin/api-keys", "/admin/system", "/admin/settings/rate-limits", "/admin/settings/alerting", "/admin/settings/maintenance"],
        sections: [
            {
                header: "Operations",
                headerKey: "sidebar_operations",
                items: [
                    { href: "/admin/cron", label: "Cron Jobs", labelKey: "sidebar_cron", icon: Clock },
                    { href: "/admin/email-queue", label: "Email Queue", labelKey: "sidebar_emailQueue", icon: Inbox },
                    { href: "/admin/backup", label: "Backup & Restore", labelKey: "sidebar_backup", icon: Database },
                    { href: "/admin/system", label: "System Health", labelKey: "sidebar_systemHealth", icon: Server },
                ],
            },
            {
                header: "Security",
                headerKey: "sidebar_security",
                items: [
                    { href: "/admin/settings/rate-limits", label: "Rate Limits", labelKey: "sidebar_rateLimits", icon: Gauge },
                    { href: "/admin/settings/alerting", label: "Health Alerts", labelKey: "sidebar_alerting", icon: Bell },
                    { href: "/admin/settings/maintenance", label: "Maintenance Mode", labelKey: "sidebar_maintenance", icon: Wrench },
                ],
            },
            {
                header: "Developer",
                headerKey: "sidebar_developer",
                items: [
                    { href: "/admin/api-docs", label: "API Reference", labelKey: "sidebar_apiDocs", icon: FileJson },
                    { href: "/admin/api-keys", label: "API Keys", labelKey: "sidebar_apiKeys", icon: KeyRound },
                ],
            },
        ],
    },
    {
        id: "settings",
        icon: Settings,
        label: "Settings",
        labelKey: "sidebar_settings",
        pathPrefix: ["/admin/settings"],
        sections: [
            {
                items: [
                    { href: "/admin/settings/general", label: "General", labelKey: "sidebar_general", icon: Cog },
                    { href: "/admin/settings/site", label: "Site Config", labelKey: "sidebar_siteConfig", icon: Globe },
                    { href: "/admin/settings", label: "All Settings", labelKey: "sidebar_allSettings", icon: Settings },
                ],
            },
        ],
    },
];

/**
 * Heuristic: figure out which nav group a module should slot into based
 * on its id. Used when a module's `menu[].group` isn't explicitly set.
 */
const MODULE_GROUP_HINTS: Record<string, string> = {
    // Content
    blog: "content",
    forum: "content",
    suggestions: "content",
    changelog: "content",
    announcements: "content",
    "help-center": "content",
    "custom-pages": "content",
    "custom-forms": "content",
    downloads: "content",
    popups: "content",
    "cookie-consent": "design",
    slider: "design",
    "email-templates": "design",
    // Users
    staff: "users",
    punishments: "users",
    "two-factor-auth": "users",
    "login-protection": "users",
    "google-auth": "users",
    "discord-auth": "users",
    referral: "users",
    // Commerce
    store: "commerce",
    "paypal-gateway": "commerce",
    "stripe-gateway": "commerce",
    credits: "commerce",
    currency: "commerce",
    // Activity / Community
    leaderboard: "activity",
    vote: "activity",
    wheel: "activity",
    tickets: "activity",
    "player-profiles": "activity",
    "in-app-notifications": "activity",
    // Advanced / Infra
    "cloudflare-r2": "advanced",
    "cloudflare-turnstile": "advanced",
    "webhook-logs": "advanced",
    "google-analytics": "advanced",
    "resend-provider": "advanced",
    "discord-integration": "advanced",
    "discord-widget": "advanced",
    "csv-import-export": "advanced",
    seo: "advanced",
    servers: "advanced",
};

export function inferModuleGroup(moduleId: string): string {
    return MODULE_GROUP_HINTS[moduleId] || "content";
}

/**
 * Finds which group a given pathname belongs to. Returns the group id
 * or null if no group matches.
 *
 * Matching strategy:
 *   1. Exact /admin → dashboard
 *   2. Longest-matching explicit `pathPrefix` across all groups
 *   3. Longest-matching item `href` across all groups (covers
 *      module-contributed entries that aren't in any pathPrefix)
 */

export function findActiveGroupId(pathname: string, groups: NavGroup[]): string | null {
    if (pathname === "/admin" || pathname === "/admin/") return "dashboard";

    let best: { id: string; length: number } | null = null;

    for (const group of groups) {
        // Explicit path prefixes
        const prefixes = Array.isArray(group.pathPrefix)
            ? group.pathPrefix
            : group.pathPrefix
                ? [group.pathPrefix]
                : [];
        for (const p of prefixes) {
            if (pathname === p || pathname.startsWith(p + "/")) {
                if (!best || p.length > best.length) {
                    best = { id: group.id, length: p.length };
                }
            }
        }

        // Item hrefs — covers module-contributed items and
        // items in groups that don't declare an explicit pathPrefix
        for (const section of group.sections) {
            for (const item of section.items) {
                if (pathname === item.href || pathname.startsWith(item.href + "/")) {
                    if (!best || item.href.length > best.length) {
                        best = { id: group.id, length: item.href.length };
                    }
                }
            }
        }
    }

    return best?.id ?? null;
}

/**
 * Build the "Theme" nav group for the currently-active theme. Returns null
 * when the active theme id is unknown (shouldn't happen, but defensive).
 * Called from the admin layout after resolving the active theme, then
 * passed as a prop to AdminSidebar.
 */
export function buildThemeNavGroup(activeThemeId: string): NavGroup | null {
    const manifest = themeRegistry[activeThemeId];
    if (!manifest) return null;

    const themeItems: ThemeAdminNavItem[] = themeAdminRoutes[activeThemeId] ?? [];

    const items: NavItem[] = [
        { label: "Appearance", href: "/admin/theme/appearance", icon: Palette },
        ...themeItems.map((i: ThemeAdminNavItem) => ({
            label: i.label,
            href: "/admin" + (i.path.startsWith("/") ? i.path : "/" + i.path),
            icon: Palette,
        })),
    ];

    const manifestAny = manifest as { adminNav?: { label?: string } };

    return {
        id: "theme",
        label: manifestAny.adminNav?.label ?? manifest.name,
        icon: Palette,
        pathPrefix: "/admin/theme",
        sections: [{ items }],
    };
}
