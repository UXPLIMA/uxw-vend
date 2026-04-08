"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { usePathname } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useDarkMode } from "@/core/hooks/useDarkMode";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    FileText,
    FolderOpen,
    Users,
    Settings,
    Puzzle,
    Ticket,
    HelpCircle,
    Shield,
    Menu,
    X,
    Tag,
    Megaphone,
    History,
    UserCheck,
    Gift,
    Download,
    Vote,
    Dices,
    Percent,
    ImageIcon,
    Search,
    Webhook,
    ScrollText,
    Server,
    Bell,
    FileEdit,
    MessageSquare,
    LayoutList,
    Layers,
    Crown,
    ClipboardCheck,
    KeyRound,
    Trophy,
    Sun,
    Moon,
    ChevronRight,
    DollarSign,
    Cloud,
    Mail,
    UserPlus,
    Globe,
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

interface ModuleGroup {
    id: string;
    label: string;
    icon: React.ReactNode;
    children: NavItem[];
}

interface SidebarModule {
    id: string;
    menu?: { path: string; label: string; icon?: string }[];
}

const coreNavDefs = [
    { href: "/admin", labelKey: "sidebar_dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/admin/modules", labelKey: "sidebar_modules", icon: <Puzzle size={18} /> },
] as const;

const coreToolDefs = [
    { href: "/admin/users", labelKey: "sidebar_users", icon: <Users size={18} /> },
    { href: "/admin/roles", labelKey: "sidebar_roles", icon: <Shield size={18} /> },
    { href: "/admin/settings", labelKey: "sidebar_settings", icon: <Settings size={18} /> },
    { href: "/admin/system", labelKey: "sidebar_systemHealth", icon: <Server size={18} /> },
    { href: "/admin/activity-log", labelKey: "sidebar_activityLog", icon: <ScrollText size={18} /> },
    { href: "/admin/api-keys", labelKey: "sidebar_apiKeys", icon: <KeyRound size={18} /> },
] as const;

interface AdminSidebarProps {
    userName?: string;
    userEmail?: string;
    modules?: SidebarModule[];
}

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
    LayoutDashboard, Package, ShoppingCart, FileText, FolderOpen, Users,
    Settings, Puzzle, Ticket, HelpCircle, Tag, Megaphone, History,
    UserCheck, Gift, Download, Vote, Dices, Percent, ImageIcon, Search,
    Webhook, ScrollText, Server, Bell, FileEdit, Shield, Menu, X,
    MessageSquare, LayoutList, Layers, Crown, ClipboardCheck, KeyRound, Trophy,
    DollarSign, Cloud, Mail, UserPlus, Globe,
};

const DynamicIcon = ({ name, size = 18 }: { name: string; size?: number }) => {
    const Icon = iconMap[name] || Package;
    return <Icon size={size} />;
};

const STORAGE_KEY = "admin_sidebar_state_v2";

interface SidebarState {
    modulesOpen: boolean;
    expandedModules: string[];
}

function loadState(): SidebarState {
    if (typeof window === "undefined") return { modulesOpen: true, expandedModules: [] };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { modulesOpen: true, expandedModules: [] };
        const parsed = JSON.parse(raw);
        return {
            modulesOpen: parsed.modulesOpen !== false,
            expandedModules: Array.isArray(parsed.expandedModules) ? parsed.expandedModules : [],
        };
    } catch {
        return { modulesOpen: true, expandedModules: [] };
    }
}

function saveState(state: SidebarState) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* ignore */
    }
}

export function AdminSidebar({ modules = [] }: AdminSidebarProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isDark, toggle: toggleDarkMode } = useDarkMode();
    const t = useTranslations("admin");

    const [modulesOpen, setModulesOpen] = useState(true);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

    // Load persisted state on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        const s = loadState();
        setModulesOpen(s.modulesOpen);
        setExpandedModules(new Set(s.expandedModules));
    }, []);

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin";
        return pathname.startsWith(href);
    };

    // Resolve a module's display label
    const resolveModuleLabel = (mod: SidebarModule): string => {
        const key = `menu_${mod.id}`;
        if (t.has(key)) return t(key);
        // Fallback: capitalize id
        return mod.id.charAt(0).toUpperCase() + mod.id.slice(1).replace(/-/g, " ");
    };

    // Resolve a module's first/representative icon
    const resolveModuleIcon = (mod: SidebarModule): string => {
        return mod.menu?.[0]?.icon || "Puzzle";
    };

    // Build module tree: separate single-page modules and multi-page modules
    const { singleModules, groupedModules } = useMemo(() => {
        const singles: NavItem[] = [];
        const groups: ModuleGroup[] = [];

        for (const mod of modules) {
            if (!mod.menu || mod.menu.length === 0) continue;

            if (mod.menu.length === 1) {
                // Single-page → flat button
                const item = mod.menu[0];
                const key = `menu_${mod.id}`;
                const label = t.has(key) ? t(key) : item.label;
                singles.push({
                    href: `/admin${item.path.startsWith("/") ? item.path : "/" + item.path}`,
                    label,
                    icon: <DynamicIcon name={item.icon || "Puzzle"} />,
                });
            } else {
                // Multi-page → nested group
                const children: NavItem[] = mod.menu.map((item, idx) => {
                    const itemKey = `menu_${mod.id}_${idx}`;
                    const label = t.has(itemKey) ? t(itemKey) : item.label;
                    return {
                        href: `/admin${item.path.startsWith("/") ? item.path : "/" + item.path}`,
                        label,
                        icon: <DynamicIcon name={item.icon || "Puzzle"} size={16} />,
                    };
                });
                groups.push({
                    id: mod.id,
                    label: resolveModuleLabel(mod),
                    icon: <DynamicIcon name={resolveModuleIcon(mod)} />,
                    children,
                });
            }
        }

        // Sort alphabetically
        singles.sort((a, b) => a.label.localeCompare(b.label));
        groups.sort((a, b) => a.label.localeCompare(b.label));
        return { singleModules: singles, groupedModules: groups };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modules, t]);

    // Auto-expand the group containing the active route
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        const activeGroup = groupedModules.find((g) => g.children.some((c) => isActive(c.href)));
        if (activeGroup && !expandedModules.has(activeGroup.id)) {
            setExpandedModules((prev) => {
                const next = new Set(prev);
                next.add(activeGroup.id);
                return next;
            });
            setModulesOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, groupedModules]);

    // Persist state when it changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        saveState({ modulesOpen, expandedModules: Array.from(expandedModules) });
    }, [modulesOpen, expandedModules]);

    const toggleModuleGroup = (id: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const coreNavItems: NavItem[] = coreNavDefs.map((d) => ({
        href: d.href,
        label: t(d.labelKey),
        icon: d.icon,
    }));

    const coreToolItems: NavItem[] = coreToolDefs.map((d) => ({
        href: d.href,
        label: t(d.labelKey),
        icon: d.icon,
    }));

    const renderLink = (item: NavItem, indent = false) => (
        <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                indent ? "ml-6" : ""
            } ${isActive(item.href) ? "active" : "text-muted-foreground hover:text-foreground"}`}
        >
            {item.icon}
            <span className="truncate">{item.label}</span>
        </Link>
    );

    const hasAnyModules = singleModules.length > 0 || groupedModules.length > 0;

    const sidebarContent = (
        <>
            <Link href="/" className="flex items-center mb-6 px-3" onClick={() => setMobileOpen(false)}>
                <span className="font-bold text-xl text-foreground">uxwVend</span>
            </Link>

            <nav className="space-y-0.5 mb-6 px-1 flex-1">
                {/* Core nav */}
                {coreNavItems.map((item) => renderLink(item))}

                {/* Modules group (forum-engine-style) */}
                {hasAnyModules && (
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={() => setModulesOpen(!modulesOpen)}
                            className="admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-muted-foreground hover:text-foreground"
                        >
                            <Puzzle size={18} />
                            <span className="flex-1 text-left font-medium">{t.has("sidebar_modulesGroup") ? t("sidebar_modulesGroup") : "Modules"}</span>
                            <ChevronRight
                                size={16}
                                className={`transition-transform ${modulesOpen ? "rotate-90" : ""}`}
                            />
                        </button>

                        {modulesOpen && (
                            <div className="mt-1 space-y-0.5">
                                {/* Single-page modules first */}
                                {singleModules.map((item) => renderLink(item, true))}

                                {/* Multi-page module groups */}
                                {groupedModules.map((group) => {
                                    const isOpen = expandedModules.has(group.id);
                                    const hasActiveChild = group.children.some((c) => isActive(c.href));
                                    return (
                                        <div key={group.id}>
                                            <button
                                                type="button"
                                                onClick={() => toggleModuleGroup(group.id)}
                                                className={`admin-sidebar-link flex items-center gap-3 px-3 py-2 ml-6 rounded-lg text-sm w-full ${
                                                    hasActiveChild ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {group.icon}
                                                <span className="flex-1 text-left truncate">{group.label}</span>
                                                <ChevronRight
                                                    size={14}
                                                    className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                                                />
                                            </button>
                                            {isOpen && (
                                                <div className="mt-0.5 space-y-0.5">
                                                    {group.children.map((child) => (
                                                        <Link
                                                            key={child.href}
                                                            href={child.href}
                                                            onClick={() => setMobileOpen(false)}
                                                            className={`admin-sidebar-link flex items-center gap-3 px-3 py-1.5 ml-12 rounded-lg text-sm ${
                                                                isActive(child.href)
                                                                    ? "active"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            {child.icon}
                                                            <span className="truncate">{child.label}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Core tools */}
                <div className="mt-3">{coreToolItems.map((item) => renderLink(item))}</div>
            </nav>

            {/* Dark mode toggle */}
            <div className="px-1 mt-auto pt-4 border-t border-border">
                <button
                    onClick={toggleDarkMode}
                    className="admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-muted-foreground hover:text-foreground"
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    {isDark ? t("sidebar_lightMode") : t("sidebar_darkMode")}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border shadow-sm flex items-center justify-center"
            >
                <Menu size={20} />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <aside
                className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto z-50 transition-transform duration-200 flex flex-col ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                    className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                >
                    <X size={18} />
                </button>
                {sidebarContent}
            </aside>

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto">
                {sidebarContent}
            </aside>
        </>
    );
}
